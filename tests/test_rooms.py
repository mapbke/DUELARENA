import os
import tempfile
import time
import unittest
from unittest.mock import patch

os.environ['DATABASE_PATH'] = tempfile.mktemp(suffix='.sqlite3')
os.environ['ROUND_COUNTDOWN'] = '0.01'
import app as game


class RoomsTest(unittest.TestCase):
    def setUp(self):
        game.ROOMS.clear()
        game.RATE_BUCKETS.clear()
        self.sockets = []
        self.tasks = patch.object(game.socketio, 'start_background_task')
        self.tasks.start()

    def tearDown(self):
        for s in self.sockets:
            if s.is_connected():
                s.disconnect()
        self.tasks.stop()

    def player(self, name):
        http = game.app.test_client()
        http.post('/login/guest', data={'display_name': name})
        sock = game.socketio.test_client(game.app, flask_test_client=http)
        self.sockets.append(sock)
        sock.get_received()
        return http, sock

    def events(self, sock, name):
        return [e['args'][0] for e in sock.get_received() if e['name'] == name]

    def room(self, mode='reaction'):
        ah, a = self.player('A')
        bh, b = self.player('B')
        a.emit('room_create', {'mode': mode})
        code = self.events(a, 'room_created')[0]['room']
        b.emit('room_join', {'room': code.lower()})
        a.get_received(); b.get_received()
        return code, ah, a, bh, b

    def start(self, code, a, b):
        a.emit('room_ready'); b.emit('room_ready')
        token = game.ROOMS[code]['token']
        game.begin_round(code, token)
        a.get_received(); b.get_received()
        return token

    def test_invite_auth_and_canonical_route(self):
        code, ah, a, bh, b = self.room()
        self.assertEqual(ah.get('/r/'+code).status_code, 200)
        fresh = game.app.test_client()
        response = fresh.get('/r/'+code)
        self.assertIn('next=/r/'+code, response.location)
        response = fresh.post('/login/guest', data={'display_name':'C', 'next':'/r/'+code})
        self.assertEqual(response.location, '/r/'+code)
        self.assertEqual(ah.get('/r/ZZZZZ').status_code, 404)

    def test_capacity_and_invalid_join_preserves_old_room(self):
        code, ah, a, bh, b = self.room()
        ch, c = self.player('C')
        c.emit('room_join', {'room':code})
        self.assertEqual(self.events(c,'room_error')[0]['code'], 'room_full')
        a.emit('room_join', {'room':'ZZZZZ'})
        self.assertEqual(len(game.ROOMS[code]['players']),2)
        self.assertEqual(self.events(a,'room_error')[0]['code'], 'room_not_found')

    def test_reaction_result_duplicate_and_rematch(self):
        code, ah, a, bh, b = self.room()
        token = self.start(code,a,b)
        a.emit('reaction_click', {'token': token})
        game.ROOMS[code]['go_at'] = time.perf_counter() - .2
        b.emit('reaction_click', {'token': token})
        ar=self.events(a,'round_result'); br=self.events(b,'round_result')
        self.assertEqual(ar,br)
        self.assertEqual(ar[0]['winner']['display_name'],'B')
        self.assertTrue(ar[0]['players'][0]['meta']['false_start'])
        a.emit('reaction_click', {'token':token})
        self.assertFalse(self.events(a,'round_result'))
        self.start(code,a,b)
        self.assertEqual(game.ROOMS[code]['round'],2)

    def test_disconnect_cancels_and_reconnect_preserves_room(self):
        code, ah, a, bh, b = self.room()
        self.start(code,a,b)
        b.disconnect()
        room=game.ROOMS[code]
        self.assertEqual(room['state'],'lobby')
        self.assertEqual(room['notice'],'round_interrupted')
        newer=game.socketio.test_client(game.app,flask_test_client=bh)
        self.sockets.append(newer)
        newer.emit('room_join',{'room':code})
        self.assertEqual(len(room['players']),2)
        self.assertTrue(all(p['connected'] for p in room['players'].values()))
        self.start(code,a,newer)
        self.assertEqual(room['state'],'playing')

    def test_replaced_socket_cannot_act(self):
        code, ah, a, bh, b = self.room()
        replacement=game.socketio.test_client(game.app,flask_test_client=ah)
        self.sockets.append(replacement)
        replacement.emit('room_join',{'room':code})
        a.emit('room_leave')
        self.assertEqual(len(game.ROOMS[code]['players']),2)
        self.assertEqual(self.events(a,'room_error')[0]['code'],'not_in_room')

    def test_expiry_and_malformed_payload(self):
        code, ah, a, bh, b = self.room()
        for payload in [[], 'x', {'room': {}}, {'room': 'OOOOO'}]:
            a.emit('room_join',payload)
            self.assertTrue(self.events(a,'room_error'))
        game.ROOMS[code]['created_at'] -= game.ROOM_TTL+1
        game.expire_rooms()
        self.assertNotIn(code,game.ROOMS)
        self.assertTrue(self.events(a,'room_expired'))

    def test_all_other_games_same_result(self):
        for mode in ['typing','cps','aim','blind']:
            with self.subTest(mode=mode):
                code, ah, a, bh, b = self.room(mode)
                token = self.start(code,a,b)
                room=game.ROOMS[code]
                if mode=='typing':
                    phrase=room['game_data']['phrase']
                    a.emit('typing_finish',{'token':token,'text':phrase})
                    b.emit('typing_finish',{'token':token,'text':phrase})
                elif mode=='cps':
                    a.emit('cps_click',{'token':token})
                    with patch.object(game.socketio,'sleep'):
                        game.cps_end_task(code,token)
                elif mode=='aim':
                    a.emit('aim_hit',{'token':token,'index':'invalid'})
                    for index in range(15):
                        a.emit('aim_hit',{'token':token,'index':index})
                        b.emit('aim_hit',{'token':token,'index':index})
                else:
                    a.emit('blind_stop',{'token':token})
                    b.emit('blind_stop',{'token':token})
                ar=self.events(a,'round_result');br=self.events(b,'round_result')
                self.assertEqual(len(ar),1)
                self.assertEqual(ar,br)
                self.assertEqual(room['state'],'finished')
                self.start(code,a,b)
                self.assertEqual(room['round'],2)

    def test_timeout_draw(self):
        code, ah, a, bh, b = self.room()
        token=self.start(code,a,b)
        game.timeout_task(code,token,0)
        result=self.events(a,'round_result')[0]
        self.assertTrue(result['draw'])
        self.assertEqual(result,self.events(b,'round_result')[0])


if __name__=='__main__':
    unittest.main()

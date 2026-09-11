"""Real HTTP + Socket.IO smoke test with separate cookie jars, not browser QA."""
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import time
import requests
import socketio

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:5099'

def wait_event(events,name):
    deadline=time.monotonic()+12
    while time.monotonic()<deadline:
        event,data=events.get(timeout=max(.01,deadline-time.monotonic()))
        if event==name:
            return data
    raise AssertionError('Missing event '+name)

with tempfile.TemporaryDirectory() as temp:
    env={**os.environ,'BASE_URL':BASE,'SECRET_KEY':'smoke-test-only','ROUND_COUNTDOWN':'.1',
         'DATABASE_PATH':str(Path(temp)/'test.sqlite3')}
    with open(Path(temp)/'server.log','w+') as log:
        server=subprocess.Popen([sys.executable,'-m','gunicorn','-w','1','--threads','100','--bind','127.0.0.1:5099','app:app'],cwd=ROOT,env=env,stdout=log,stderr=log)
        clients=[]
        try:
            for _ in range(80):
                try:
                    if requests.get(BASE+'/health',timeout=.2).ok:break
                except requests.RequestException:pass
                time.sleep(.1)
            else:raise AssertionError('Server did not start')
            sessions=[];streams=[]
            for name in ['A','B']:
                session=requests.Session()
                session.post(BASE+'/login/guest',data={'display_name':name},timeout=5).raise_for_status()
                events=queue.Queue();streams.append(events)
                client=socketio.Client(http_session=session)
                client.on('*',lambda event,data,q=events:q.put((event,data)))
                client.connect(BASE,transports=['polling','websocket'])
                clients.append(client);sessions.append(session)
            a,b=clients;aq,bq=streams
            a.emit('room_create',{'mode':'reaction','language':'ru'})
            code=wait_event(aq,'room_created')['room']
            assert sessions[1].get(BASE+'/r/'+code,timeout=5).status_code==200
            b.emit('room_join',{'room':code})
            wait_event(bq,'room_joined')
            a.emit('room_ready');b.emit('room_ready')
            token=wait_event(aq,'round_start')['token']
            wait_event(bq,'round_start')
            wait_event(aq,'reaction_go');wait_event(bq,'reaction_go')
            a.emit('reaction_click',{'token':token});time.sleep(.05);b.emit('reaction_click',{'token':token})
            ar=wait_event(aq,'round_result');br=wait_event(bq,'round_result')
            assert ar==br and ar['winner']['display_name']=='A'
            a.emit('room_ready');b.emit('room_ready')
            wait_event(aq,'round_start');wait_event(bq,'round_start')
            b.disconnect()
            while True:
                room=wait_event(aq,'room_state')
                if room['notice']=='round_interrupted':break
            b.connect(BASE,transports=['polling','websocket']);b.emit('room_join',{'room':code})
            wait_event(bq,'room_joined')
            print('PASS: Gunicorn, two cookie jars, invite, synchronized result, rematch, disconnect cancellation, reconnect')
            print('Transports:',a.transport(),b.transport())
        except Exception:
            log.seek(0);print(log.read(),file=sys.stderr);raise
        finally:
            for client in clients:
                if client.connected:client.disconnect()
            server.terminate();server.wait(timeout=10)

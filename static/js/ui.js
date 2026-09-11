(() => {
    const dictionaries = {
        en: {
            "server.connecting":"Connecting","server.online":"Online","server.offline":"Offline",
            "settings.language":"Language","settings.theme":"Theme","theme.system":"System","theme.dark":"Dark","theme.light":"Light",
            "nav.stats":"Statistics","nav.logout":"Log out","nav.back":"Back to hub",
            "login.kicker":"PRIVATE 1V1 BROWSER GAMES","login.title1":"Play your friend.","login.title2":"Settle it instantly.","login.description":"Create a private room, share the code and compete in reaction, typing, CPS, aim and timing games.","login.point1":"No installation","login.point2":"Private rooms","login.point3":"Instant rematches","login.welcome":"Welcome to DuoArena","login.choose":"Choose how you want to continue.","login.google":"Continue with Google","login.github":"Continue with GitHub","login.googleUnavailable":"Google is not configured","login.githubUnavailable":"GitHub is not configured","login.or":"or","login.guestName":"Guest name","login.guestPlaceholder":"Your nickname","login.guest":"Play as Guest","login.guestNote":"Guest progress is tied to this browser session. Use Google or GitHub to keep a stable identity.",
            "home.eyebrow":"PRIVATE 1V1 ARENA","home.title1":"Pick a game.","home.title2":"Beat your friend.","home.description":"Create a room, send the code and start a duel in seconds.","home.modesEyebrow":"GAME MODES","home.modesTitle":"Choose your arena",
            "stats.wins":"Wins","stats.losses":"Losses","stats.winrate":"Winrate",
            "mode.reaction.tag":"REACTION","mode.reaction.name":"Reaction Duel","mode.reaction.desc":"Wait for green. The fastest valid click wins.","mode.reaction.rule":"Lowest ms",
            "mode.typing.tag":"TYPING","mode.typing.name":"Typing Duel","mode.typing.desc":"Same text, same start. Highest WPM wins.","mode.typing.rule":"Highest WPM",
            "mode.cps.tag":"CLICKS","mode.cps.name":"CPS Battle","mode.cps.desc":"Ten seconds. Maximum clicks. Nothing else matters.","mode.cps.rule":"Most clicks",
            "mode.aim.tag":"AIM","mode.aim.name":"Aim Duel","mode.aim.desc":"Hit 15 targets. Fastest target pace wins.","mode.aim.rule":"Fastest pace",
            "mode.blind.tag":"TIMING","mode.blind.name":"Blind Timing","mode.blind.desc":"Stop as close as possible to exactly 5.000 seconds.","mode.blind.rule":"Lowest error",
            "lobby.eyebrow":"PRIVATE ROOM","lobby.title":"Create or join a room","lobby.room":"Room","lobby.create":"Create room","lobby.createHint":"Get a code and invite your opponent","lobby.orJoin":"or join by code","lobby.join":"Join","lobby.code":"Room code","lobby.copy":"Copy","lobby.copied":"Copied","lobby.leave":"Leave","lobby.ready":"I'm ready","lobby.readyDone":"Ready ✓",
            "lobby.status.created":"Room {room} created. Send the code to your opponent.","lobby.status.reconnecting":"Opponent is reconnecting.","lobby.status.both":"Both players are here. Press ready.","lobby.status.starting":"Both players are ready. Starting round...","lobby.status.left":"{name} left the room.","lobby.status.result":"{name} wins this round.","lobby.status.draw":"This round is a draw.","lobby.status.notReady":"Not ready","lobby.status.ready":"Ready","lobby.status.empty":"Waiting for player","lobby.status.reconnect":"Reconnecting",
            "error.authentication_required":"Please sign in first.","error.invalid_room_code":"Room code must contain 5 characters.","error.room_not_found":"Room not found.","error.room_full":"Room is already full.","error.not_in_room":"Join a room first.","error.waiting_for_opponent":"Waiting for the second player.","error.invalid_score":"Invalid score.","error.wrong_score_handler":"Wrong score handler.","error.round_finished":"This round has already ended.",
            "stage.locked":"Connect to a room first","stage.lockedHint":"The game unlocks when both players are ready.",
            "reaction.waitingRound":"WAITING FOR ROUND","reaction.dontClick":"Don't click before green.","reaction.wait":"WAIT...","reaction.falseStartHint":"Clicking now is a false start.","reaction.click":"CLICK!","reaction.now":"Now.","reaction.sent":"RESULT SENT","reaction.falseStart":"FALSE START",
            "typing.placeholder":"Round has not started","typing.playPlaceholder":"Type the text above...","typing.speed":"Speed","typing.accuracy":"Accuracy",
            "cps.timeLeft":"TIME LEFT","cps.clicks":"Clicks","cps.waiting":"WAITING","cps.click":"CLICK!","cps.sent":"RESULT SENT",
            "aim.waiting":"WAITING FOR ROUND","aim.hits":"Hits","aim.pace":"Targets/s",
            "blind.target":"TARGET","blind.waiting":"WAITING","blind.stop":"STOP","blind.sent":"RESULT SENT","blind.result":"Result","blind.error":"Error",
            "result.winner":"Winner","result.victory":"VICTORY","result.defeat":"DEFEAT","result.draw":"DRAW","result.round":"ROUND {round} COMPLETE","result.rematch":"Ready for rematch","result.home":"Back to hub","result.best":"Best result: {score}",
            "stats.global":"GLOBAL STATS","stats.description":"Recent duels, leaderboard and player records.","stats.players":"Players","stats.matches":"Matches","stats.topPlayer":"Top player","stats.ranking":"RANKING","stats.leaderboard":"Leaderboard","stats.player":"Player","stats.history":"HISTORY","stats.recent":"Recent matches","stats.empty":"No completed matches yet.","stats.topSub":"{wins} wins · {losses} losses","stats.winner":"Winner","stats.loser":"Loser"
        },
        ru: {
            "server.connecting":"Подключение","server.online":"Онлайн","server.offline":"Нет связи",
            "settings.language":"Язык","settings.theme":"Тема","theme.system":"Системная","theme.dark":"Тёмная","theme.light":"Светлая",
            "nav.stats":"Статистика","nav.logout":"Выйти","nav.back":"На главную",
            "login.kicker":"ПРИВАТНЫЕ 1V1 ИГРЫ В БРАУЗЕРЕ","login.title1":"Позови друга.","login.title2":"Выясни, кто лучше.","login.description":"Создай приватную комнату, отправь код и соревнуйся в реакции, печати, CPS, аиме и чувстве времени.","login.point1":"Без установки","login.point2":"Приватные комнаты","login.point3":"Мгновенный реванш","login.welcome":"Добро пожаловать в DuoArena","login.choose":"Выбери способ входа.","login.google":"Продолжить с Google","login.github":"Продолжить с GitHub","login.googleUnavailable":"Google пока не настроен","login.githubUnavailable":"GitHub пока не настроен","login.or":"или","login.guestName":"Имя гостя","login.guestPlaceholder":"Твой ник","login.guest":"Играть как гость","login.guestNote":"Гостевой аккаунт привязан к этой сессии браузера. Google или GitHub дают постоянную личность.",
            "home.eyebrow":"ПРИВАТНАЯ 1V1 АРЕНА","home.title1":"Выбери игру.","home.title2":"Обыграй друга.","home.description":"Создай комнату, отправь код и начни дуэль за несколько секунд.","home.modesEyebrow":"РЕЖИМЫ","home.modesTitle":"Выбери арену",
            "stats.wins":"Победы","stats.losses":"Поражения","stats.winrate":"Винрейт",
            "mode.reaction.tag":"РЕАКЦИЯ","mode.reaction.name":"Reaction Duel","mode.reaction.desc":"Жди зелёного сигнала. Побеждает самый быстрый честный клик.","mode.reaction.rule":"Меньше ms",
            "mode.typing.tag":"ПЕЧАТЬ","mode.typing.name":"Typing Duel","mode.typing.desc":"Один текст, один старт. Побеждает больший WPM.","mode.typing.rule":"Больше WPM",
            "mode.cps.tag":"КЛИКИ","mode.cps.name":"CPS Battle","mode.cps.desc":"Десять секунд. Максимум кликов. Больше ничего.","mode.cps.rule":"Больше кликов",
            "mode.aim.tag":"АИМ","mode.aim.name":"Aim Duel","mode.aim.desc":"Попади по 15 целям быстрее соперника.","mode.aim.rule":"Быстрее темп",
            "mode.blind.tag":"ТАЙМИНГ","mode.blind.name":"Blind Timing","mode.blind.desc":"Останови таймер максимально близко к 5.000 секундам.","mode.blind.rule":"Меньше ошибка",
            "lobby.eyebrow":"ПРИВАТНАЯ КОМНАТА","lobby.title":"Создай комнату или войди по коду","lobby.room":"Комната","lobby.create":"Создать комнату","lobby.createHint":"Получи код и позови соперника","lobby.orJoin":"или войди по коду","lobby.join":"Войти","lobby.code":"Код комнаты","lobby.copy":"Копировать","lobby.copied":"Скопировано","lobby.leave":"Выйти","lobby.ready":"Я готов","lobby.readyDone":"Готов ✓",
            "lobby.status.created":"Комната {room} создана. Отправь код сопернику.","lobby.status.reconnecting":"Соперник переподключается.","lobby.status.both":"Оба игрока в комнате. Нажмите готовность.","lobby.status.starting":"Оба готовы. Запускаем раунд...","lobby.status.left":"{name} вышел из комнаты.","lobby.status.result":"{name} побеждает в раунде.","lobby.status.draw":"В этом раунде ничья.","lobby.status.notReady":"Не готов","lobby.status.ready":"Готов","lobby.status.empty":"Ждём игрока","lobby.status.reconnect":"Переподключение",
            "error.authentication_required":"Сначала войди в аккаунт.","error.invalid_room_code":"Код комнаты состоит из 5 символов.","error.room_not_found":"Комната не найдена.","error.room_full":"Комната уже заполнена.","error.not_in_room":"Сначала войди в комнату.","error.waiting_for_opponent":"Ждём второго игрока.","error.invalid_score":"Некорректный результат.","error.wrong_score_handler":"Неверный обработчик результата.","error.round_finished":"Этот раунд уже завершён.",
            "stage.locked":"Сначала подключись к комнате","stage.lockedHint":"Игра откроется, когда оба игрока будут готовы.",
            "reaction.waitingRound":"ЖДЁМ РАУНД","reaction.dontClick":"Не кликай раньше зелёного.","reaction.wait":"ЖДИ...","reaction.falseStartHint":"Клик сейчас — фальстарт.","reaction.click":"КЛИКАЙ!","reaction.now":"Сейчас.","reaction.sent":"РЕЗУЛЬТАТ ОТПРАВЛЕН","reaction.falseStart":"ФАЛЬСТАРТ",
            "typing.placeholder":"Раунд ещё не начался","typing.playPlaceholder":"Печатай текст выше...","typing.speed":"Скорость","typing.accuracy":"Точность",
            "cps.timeLeft":"ОСТАЛОСЬ","cps.clicks":"Клики","cps.waiting":"ОЖИДАНИЕ","cps.click":"КЛИКАЙ!","cps.sent":"РЕЗУЛЬТАТ ОТПРАВЛЕН",
            "aim.waiting":"ЖДЁМ РАУНД","aim.hits":"Попадания","aim.pace":"Целей/сек",
            "blind.target":"ЦЕЛЬ","blind.waiting":"ОЖИДАНИЕ","blind.stop":"СТОП","blind.sent":"РЕЗУЛЬТАТ ОТПРАВЛЕН","blind.result":"Результат","blind.error":"Ошибка",
            "result.winner":"Победитель","result.victory":"ПОБЕДА","result.defeat":"ПОРАЖЕНИЕ","result.draw":"НИЧЬЯ","result.round":"РАУНД {round} ЗАВЕРШЁН","result.rematch":"Готов к реваншу","result.home":"На главную","result.best":"Лучший результат: {score}",
            "stats.global":"ОБЩАЯ СТАТИСТИКА","stats.description":"Последние дуэли, лидерборд и результаты игроков.","stats.players":"Игроки","stats.matches":"Матчи","stats.topPlayer":"Топ игрок","stats.ranking":"РЕЙТИНГ","stats.leaderboard":"Лидерборд","stats.player":"Игрок","stats.history":"ИСТОРИЯ","stats.recent":"Последние матчи","stats.empty":"Завершённых матчей пока нет.","stats.topSub":"{wins} побед · {losses} поражений","stats.winner":"Победитель","stats.loser":"Проигравший"
        }
    };

    const boot = window.__DUO_BOOT__ || {};
    let language = boot.lang || "en";
    let theme = boot.theme || "system";

    function format(template, vars = {}) { return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`); }
    function t(key, vars = {}) { const dict = dictionaries[language] || dictionaries.en; return format(dict[key] ?? dictionaries.en[key] ?? key, vars); }
    function applyTranslations() {
        document.documentElement.lang = language;
        document.querySelectorAll("[data-i18n]").forEach(node => node.textContent = t(node.dataset.i18n));
        document.querySelectorAll("[data-i18n-placeholder]").forEach(node => node.placeholder = t(node.dataset.i18nPlaceholder));
        window.dispatchEvent(new CustomEvent("duo:language-changed", { detail: { language } }));
    }
    function resolvedTheme(value) { if (value !== "system") return value; return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    function applyTheme() {
        document.documentElement.dataset.theme = resolvedTheme(theme);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = document.documentElement.dataset.theme === "dark" ? "#0b0b0d" : "#f6f6f8";
    }
    function setLanguage(next) { language = next === "ru" ? "ru" : "en"; localStorage.setItem("duo_lang", language); applyTranslations(); }
    function setTheme(next) { theme = ["system","dark","light"].includes(next) ? next : "system"; localStorage.setItem("duo_theme", theme); applyTheme(); }

    const languageSelect = document.getElementById("language-select");
    const themeSelect = document.getElementById("theme-select");
    if (languageSelect) { languageSelect.value = language; languageSelect.addEventListener("change", () => setLanguage(languageSelect.value)); }
    if (themeSelect) { themeSelect.value = theme; themeSelect.addEventListener("change", () => setTheme(themeSelect.value)); }

    const userButton = document.getElementById("user-menu-button");
    const userPopover = document.getElementById("user-popover");
    const settingsButton = document.getElementById("settings-button");
    const settingsPopover = document.getElementById("settings-popover");
    userButton?.addEventListener("click", e => { e.stopPropagation(); userPopover?.classList.toggle("open"); });
    settingsButton?.addEventListener("click", e => { e.stopPropagation(); settingsPopover?.classList.toggle("open"); });
    document.addEventListener("click", e => { if (userPopover && !userPopover.contains(e.target)) userPopover.classList.remove("open"); if (settingsPopover && !settingsPopover.contains(e.target)) settingsPopover.classList.remove("open"); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (theme === "system") applyTheme(); });

    window.DuoUI = { t, setLanguage, setTheme, get language(){return language;}, get theme(){return theme;} };
    applyTheme(); applyTranslations();
})();

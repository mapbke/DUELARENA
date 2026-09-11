(() => {
    const DICT = {
        ru: {
            "server.connecting":"Подключение","server.online":"Онлайн","server.offline":"Нет связи",
            "settings.language":"Язык","settings.theme":"Тема","theme.system":"Системная","theme.dark":"Тёмная","theme.light":"Светлая",
            "nav.stats":"Статистика","nav.logout":"Выйти","nav.back":"На главную",

            "login.kicker":"ПРИВАТНЫЕ 1V1 ИГРЫ В БРАУЗЕРЕ",
            "login.title1":"Позови друга.","login.title2":"Сыграйте дуэль.",
            "login.description":"Пять быстрых соревновательных режимов, приватные комнаты и мгновенные реванши.",
            "login.point1":"Без установки","login.point2":"Приватные ссылки","login.point3":"Пять игр на двоих",
            "login.welcome":"Добро пожаловать в DuoArena","login.choose":"Выбери способ входа.",
            "login.google":"Продолжить с Google","login.github":"Продолжить с GitHub","login.or":"или",
            "login.guestName":"Имя гостя","login.guestPlaceholder":"Твой ник","login.guest":"Играть как гость",
            "login.guestNote":"Google или GitHub дают постоянный профиль и статистику.",

            "home.eyebrow":"ПРИВАТНАЯ 1V1 АРЕНА","home.title1":"Выбери дуэль.","home.title2":"Отправь ссылку. Играй.",
            "home.description":"Создай приватную комнату, скопируй ссылку — соперник автоматически попадёт в нужную игру.",
            "home.modesEyebrow":"РЕЖИМЫ","home.modesTitle":"Выбери арену","home.modesHint":"Выбирай игру и зови друга по ссылке.",

            "stats.wins":"Победы","stats.losses":"Поражения","stats.winrate":"Винрейт",

            "mode.reaction.tag":"РЕАКЦИЯ","mode.reaction.name":"Reaction Duel","mode.reaction.desc":"Жди зелёного сигнала. Кто нажмёт быстрее? Ранний клик — фальстарт.","mode.reaction.rule":"Быстрее реакция",
            "mode.typing.tag":"ПЕЧАТЬ","mode.typing.name":"Typing Duel","mode.typing.desc":"Напечатай текст быстрее соперника. Ошибки снижают результат.","mode.typing.rule":"Скорость и точность",
            "mode.cps.tag":"КЛИКИ","mode.cps.name":"CPS Battle","mode.cps.desc":"Десять секунд. Одна кнопка. У кого больше кликов?","mode.cps.rule":"Больше кликов",
            "mode.aim.tag":"АИМ","mode.aim.name":"Aim Duel","mode.aim.desc":"Попади по 15 мишеням быстрее соперника.","mode.aim.rule":"Быстрее темп",
            "mode.blind.tag":"ТАЙМИНГ","mode.blind.name":"Blind Timing","mode.blind.desc":"Остановись ровно на пяти секундах. Таймер исчезнет — доверься чувству времени.","mode.blind.rule":"Меньше ошибка",

            "room.eyebrow":"ПРИВАТНАЯ КОМНАТА","room.title":"Создай комнату или войди по коду","room.code":"Код",
            "room.create":"Создать комнату","room.createHint":"Получишь ссылку-приглашение и короткий код.","room.or":"или войди по коду",
            "room.join":"Войти","room.invite":"Ссылка-приглашение","room.copyLink":"Копировать ссылку","room.copied":"Ссылка скопирована",
            "room.leave":"Выйти","room.waiting":"Ждём соперника.","room.ready":"Я готов","room.readyDone":"Готов ✓",
            "room.status.opponent":"Соперник подключён. Нажмите готовность.","room.status.countdown":"Оба готовы. Начинаем...",
            "room.status.playing":"Раунд идёт.","room.status.finished":"Раунд завершён. Можно играть реванш.",
            "room.player.empty":"Свободное место","room.player.ready":"Готов","room.player.notReady":"Не готов","room.player.reconnecting":"Переподключение",
            "room.series":"Серия: {wins}",

            "round.getReady":"ПРИГОТОВЬСЯ","game.locked":"Сначала подключись к комнате","game.lockedHint":"Игра откроется, когда оба игрока будут готовы.",
            "reaction.waiting":"ОЖИДАНИЕ","reaction.hint":"Не кликай раньше зелёного.","reaction.wait":"Жди сигнала","reaction.falseHint":"Клик сейчас — фальстарт.",
            "reaction.go":"ЖМИ!","reaction.sent":"Ждём соперника","reaction.false":"ФАЛЬСТАРТ",
            "typing.placeholder":"Жди начала раунда","typing.playPlaceholder":"Печатай текст выше...","typing.accuracy":"Точность","typing.progress":"Прогресс",
            "cps.time":"ОСТАЛОСЬ","cps.waiting":"ОЖИДАНИЕ","cps.click":"ЖМИ!","cps.clicks":"Клики",
            "aim.targets":"Цели","aim.time":"Время",
            "blind.goal":"ЦЕЛЬ","blind.waiting":"ОЖИДАНИЕ","blind.stop":"СТОП",

            "result.rematch":"Готов к реваншу","result.home":"На главную","result.victory":"ПОБЕДА","result.defeat":"ПОРАЖЕНИЕ","result.draw":"НИЧЬЯ",
            "result.round":"РАУНД {round} ЗАВЕРШЁН",

            "stats.global":"ОБЩАЯ СТАТИСТИКА","stats.description":"Лидерборд и последние завершённые раунды.",
            "stats.players":"Игроки","stats.matches":"Матчи","stats.topPlayer":"Топ игрок","stats.ranking":"РЕЙТИНГ","stats.leaderboard":"Лидерборд",
            "stats.player":"Игрок","stats.history":"ИСТОРИЯ","stats.recent":"Последние матчи","stats.winner":"Победитель","stats.loser":"Проигравший","stats.empty":"Матчей пока нет.",

            "missing.title":"Этой комнаты больше нет.","missing.text":"Хост мог выйти или сервер мог перезапуститься.","missing.home":"Вернуться в DuoArena",

            "error.authentication_required":"Сначала войди в аккаунт.","error.invalid_room_code":"Код комнаты состоит из пяти символов.",
            "error.room_not_found":"Комната не найдена.","error.room_full":"Комната уже заполнена.","error.round_in_progress":"В этой комнате уже идёт раунд.",
            "error.not_in_room":"Сначала войди в комнату.","error.waiting_for_opponent":"Ждём второго игрока."
        },
        en: {
            "server.connecting":"Connecting","server.online":"Online","server.offline":"Offline",
            "settings.language":"Language","settings.theme":"Theme","theme.system":"System","theme.dark":"Dark","theme.light":"Light",
            "nav.stats":"Statistics","nav.logout":"Log out","nav.back":"Back to hub",

            "login.kicker":"PRIVATE 1V1 BROWSER GAMES","login.title1":"Challenge a friend.","login.title2":"Play a duel.",
            "login.description":"Five fast competitive modes, private rooms and instant rematches.",
            "login.point1":"No installation","login.point2":"Private invite links","login.point3":"Five games for two",
            "login.welcome":"Welcome to DuoArena","login.choose":"Choose how you want to continue.",
            "login.google":"Continue with Google","login.github":"Continue with GitHub","login.or":"or",
            "login.guestName":"Guest name","login.guestPlaceholder":"Your nickname","login.guest":"Play as Guest",
            "login.guestNote":"Use Google or GitHub for a stable identity and persistent stats.",

            "home.eyebrow":"PRIVATE 1V1 ARENA","home.title1":"Pick the duel.","home.title2":"Send the link. Play.",
            "home.description":"Create a private room, copy the invite link and your opponent joins the correct game automatically.",
            "home.modesEyebrow":"GAME MODES","home.modesTitle":"Choose an arena","home.modesHint":"Choose a game and invite a friend.",

            "stats.wins":"Wins","stats.losses":"Losses","stats.winrate":"Winrate",

            "mode.reaction.tag":"REACTION","mode.reaction.name":"Reaction Duel","mode.reaction.desc":"Wait for green. Who reacts first? An early click is a false start.","mode.reaction.rule":"Lowest ms",
            "mode.typing.tag":"TYPING","mode.typing.name":"Typing Duel","mode.typing.desc":"Type faster than your opponent. Mistakes reduce your score.","mode.typing.rule":"Highest final WPM",
            "mode.cps.tag":"CLICKS","mode.cps.name":"CPS Battle","mode.cps.desc":"Ten seconds. One button. Who can click the most?","mode.cps.rule":"Most clicks",
            "mode.aim.tag":"AIM","mode.aim.name":"Aim Duel","mode.aim.desc":"Hit all 15 targets faster than your opponent.","mode.aim.rule":"Fastest pace",
            "mode.blind.tag":"TIMING","mode.blind.name":"Blind Timing","mode.blind.desc":"Stop at exactly five seconds. The clock disappears — trust your timing.","mode.blind.rule":"Lowest error",

            "room.eyebrow":"PRIVATE ROOM","room.title":"Create a room or join by code","room.code":"Code",
            "room.create":"Create room","room.createHint":"You will get an invite link and a short room code.","room.or":"or join by code",
            "room.join":"Join","room.invite":"Invite link","room.copyLink":"Copy invite link","room.copied":"Link copied",
            "room.leave":"Leave","room.waiting":"Waiting for opponent.","room.ready":"I'm ready","room.readyDone":"Ready ✓",
            "room.status.opponent":"Opponent connected. Both players can ready up.","room.status.countdown":"Both ready. Starting...",
            "room.status.playing":"Round in progress.","room.status.finished":"Round finished. Ready up for a rematch.",
            "room.player.empty":"Open slot","room.player.ready":"Ready","room.player.notReady":"Not ready","room.player.reconnecting":"Reconnecting",
            "room.series":"Series: {wins}",

            "round.getReady":"GET READY","game.locked":"Join a room to start","game.lockedHint":"The game unlocks when both players are ready.",
            "reaction.waiting":"WAITING","reaction.hint":"Do not click before green.","reaction.wait":"WAIT...","reaction.falseHint":"Clicking now is a false start.",
            "reaction.go":"CLICK!","reaction.sent":"RESULT SENT","reaction.false":"FALSE START",
            "typing.placeholder":"Wait for the round","typing.playPlaceholder":"Type the text above...","typing.accuracy":"Accuracy","typing.progress":"Progress",
            "cps.time":"TIME LEFT","cps.waiting":"WAITING","cps.click":"CLICK!","cps.clicks":"Clicks",
            "aim.targets":"Targets","aim.time":"Time",
            "blind.goal":"TARGET","blind.waiting":"WAITING","blind.stop":"STOP",

            "result.rematch":"Ready for rematch","result.home":"Back to hub","result.victory":"VICTORY","result.defeat":"DEFEAT","result.draw":"DRAW",
            "result.round":"ROUND {round} COMPLETE",

            "stats.global":"GLOBAL STATS","stats.description":"Leaderboard and recent completed rounds.",
            "stats.players":"Players","stats.matches":"Matches","stats.topPlayer":"Top player","stats.ranking":"RANKING","stats.leaderboard":"Leaderboard",
            "stats.player":"Player","stats.history":"HISTORY","stats.recent":"Recent matches","stats.winner":"Winner","stats.loser":"Loser","stats.empty":"No matches yet.",

            "missing.title":"This room no longer exists.","missing.text":"The host may have left or the server may have restarted.","missing.home":"Back to DuoArena",

            "error.authentication_required":"Please sign in first.","error.invalid_room_code":"Room code contains five characters.",
            "error.room_not_found":"Room not found.","error.room_full":"Room is already full.","error.round_in_progress":"A round is already in progress.",
            "error.not_in_room":"Join a room first.","error.waiting_for_opponent":"Waiting for the second player."
        }
    };

    const boot = window.__DUO_BOOT__ || {};
    let language = boot.lang === "en" ? "en" : "ru";
    let theme = ["dark","light","system"].includes(boot.theme) ? boot.theme : "system";

    function fmt(text, vars={}) {
        return String(text).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
    }

    function t(key, vars={}) {
        return fmt(DICT[language]?.[key] ?? DICT.en[key] ?? key, vars);
    }

    function resolvedTheme() {
        if (theme !== "system") return theme;
        return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function applyTheme() {
        document.documentElement.dataset.theme = resolvedTheme();
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            "content",
            document.documentElement.dataset.theme === "dark" ? "#09090b" : "#f5f5f7"
        );
    }

    function applyLanguage() {
        document.documentElement.lang = language;
        document.querySelectorAll("[data-i18n]").forEach(node => node.textContent = t(node.dataset.i18n));
        document.querySelectorAll("[data-i18n-placeholder]").forEach(node => node.placeholder = t(node.dataset.i18nPlaceholder));
        window.dispatchEvent(new CustomEvent("duo:language",{detail:{language}}));
    }

    const languageSelect = document.getElementById("language-select");
    const themeSelect = document.getElementById("theme-select");

    if (languageSelect) {
        languageSelect.value = language;
        languageSelect.addEventListener("change", () => {
            language = languageSelect.value === "en" ? "en" : "ru";
            localStorage.setItem("duo_lang", language);
            applyLanguage();
        });
    }

    if (themeSelect) {
        themeSelect.value = theme;
        themeSelect.addEventListener("change", () => {
            theme = ["dark","light","system"].includes(themeSelect.value) ? themeSelect.value : "system";
            localStorage.setItem("duo_theme", theme);
            applyTheme();
        });
    }

    const profileButton = document.getElementById("profile-button");
    const profilePopover = document.getElementById("profile-popover");
    const settingsButton = document.getElementById("settings-button");
    const settingsPopover = document.getElementById("settings-popover");

    profileButton?.addEventListener("click", event => {
        event.stopPropagation();
        profilePopover?.classList.toggle("open");
    });

    settingsButton?.addEventListener("click", event => {
        event.stopPropagation();
        settingsPopover?.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (profilePopover && !profilePopover.contains(event.target)) profilePopover.classList.remove("open");
        if (settingsPopover && !settingsPopover.contains(event.target)) settingsPopover.classList.remove("open");
    });

    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (theme === "system") applyTheme();
    });

    window.DuoUI = {
        t,
        get language(){ return language; },
        get theme(){ return theme; }
    };

    applyTheme();
    applyLanguage();
})();

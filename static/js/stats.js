(async () => {
    const t = key => window.DuoUI?.t(key) || key;

    const summaryPlayers = document.getElementById("summary-players");
    const summaryMatches = document.getElementById("summary-matches");
    const summaryTop = document.getElementById("summary-top");
    const summaryTopSub = document.getElementById("summary-top-sub");
    const leaderboard = document.getElementById("leaderboard-body");
    const history = document.getElementById("history-list");

    let cached = null;

    function esc(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function avatar(url,name) {
        if (url) return `<img src="${esc(url)}" alt="">`;
        return `<span class="avatar">${esc(String(name||"?").slice(0,1).toUpperCase())}</span>`;
    }

    function score(mode,value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        if (mode === "reaction") return n >= 999999 ? "FS" : `${n.toFixed(0)} ms`;
        if (mode === "typing") return `${n.toFixed(1)} WPM`;
        if (mode === "cps") return `${n.toFixed(0)} clicks`;
        if (mode === "aim") return `${n.toFixed(3)} t/s`;
        if (mode === "blind") return n >= 999999 ? "TIMEOUT" : `${(n/1000).toFixed(3)}s`;
        return String(value);
    }

    function render(data) {
        cached = data;
        summaryPlayers.textContent = data.summary?.players ?? 0;
        summaryMatches.textContent = data.summary?.matches ?? 0;

        if (data.summary?.top_player) {
            summaryTop.textContent = data.summary.top_player.display_name;
            summaryTopSub.textContent = `${data.summary.top_player.wins} W · ${data.summary.top_player.losses} L`;
        } else {
            summaryTop.textContent = "—";
            summaryTopSub.textContent = "";
        }

        const players = data.leaderboard || [];

        leaderboard.innerHTML = players.length
            ? players.map((p,index) => `
                <tr>
                    <td>${index+1}</td>
                    <td>
                        <div class="stats-user">
                            ${avatar(p.avatar_url,p.display_name)}
                            <div>
                                <strong>${esc(p.display_name)}</strong>
                                <small>${esc(p.provider)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${p.matches}</td>
                    <td style="color:var(--green)">${p.wins}</td>
                    <td>${p.losses}</td>
                    <td>${p.winrate}%</td>
                </tr>
            `).join("")
            : `<tr><td colspan="6">${esc(t("stats.empty"))}</td></tr>`;

        const matches = data.recent_matches || [];

        history.innerHTML = matches.length
            ? matches.map(m => `
                <article class="history-item">
                    <div class="history-mode">${esc(String(m.game).toUpperCase())}</div>
                    <div class="history-player winner">
                        ${avatar(m.winner_avatar_url,m.winner_name)}
                        <div><small>${esc(t("stats.winner"))}</small><strong>${esc(m.winner_name)}</strong></div>
                    </div>
                    <div class="history-score">${esc(score(m.game,m.winner_score))} vs ${esc(score(m.game,m.loser_score))}</div>
                    <div class="history-player right">
                        ${avatar(m.loser_avatar_url,m.loser_name)}
                        <div><small>${esc(t("stats.loser"))}</small><strong>${esc(m.loser_name)}</strong></div>
                    </div>
                </article>
            `).join("")
            : `<div class="history-item">${esc(t("stats.empty"))}</div>`;
    }

    const response = await fetch("/api/stats");
    render(await response.json());

    window.addEventListener("duo:language",() => {
        if (cached) render(cached);
    });
})();

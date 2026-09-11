(async () => {
    const body = document.getElementById("leaderboard-body");
    const list = document.getElementById("match-list");

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function gameName(value) {
        return {
            reaction: "Reaction",
            typing: "Typing",
            cps: "CPS",
            aim: "Aim",
            blind: "Blind",
        }[value] || value;
    }

    try {
        const response = await fetch("/api/stats");
        const data = await response.json();

        const leaderboard = data.leaderboard || [];
        body.innerHTML = leaderboard.length
            ? leaderboard.map((player, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="stats-user">
                            <img src="${escapeHtml(player.avatar_url)}" alt="">
                            <strong>${escapeHtml(player.login)}</strong>
                        </div>
                    </td>
                    <td>${player.wins}</td>
                    <td>${player.losses}</td>
                    <td>${player.winrate}%</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">Матчей пока нет.</td></tr>`;

        const matches = data.recent_matches || [];
        list.innerHTML = matches.length
            ? matches.map(match => `
                <div class="match-row">
                    <div>
                        <strong>${escapeHtml(match.winner_login || "Unknown")}</strong>
                        <span style="color:var(--success)"> победил </span>
                        <strong>${escapeHtml(match.loser_login || "Unknown")}</strong>
                    </div>
                    <small>${escapeHtml(gameName(match.game))} · ${escapeHtml(match.created_at)}</small>
                </div>
            `).join("")
            : `<div class="match-row">Завершённых матчей пока нет.</div>`;
    } catch (error) {
        console.error(error);
        body.innerHTML = `<tr><td colspan="5">Не удалось загрузить статистику.</td></tr>`;
        list.innerHTML = `<div class="match-row">Не удалось загрузить историю.</div>`;
    }
})();

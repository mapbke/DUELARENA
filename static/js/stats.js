(async () => {
    const body = document.getElementById("leaderboard-body");
    const matches = document.getElementById("match-list");

    function esc(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    try {
        const response = await fetch("/api/stats");
        const data = await response.json();

        const leaderboard = data.leaderboard || [];
        body.innerHTML = leaderboard.length
            ? leaderboard.map((p, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="stats-user">
                            <img src="${esc(p.avatar_url)}" alt="">
                            <strong>${esc(p.login)}</strong>
                        </div>
                    </td>
                    <td>${p.wins}</td>
                    <td>${p.losses}</td>
                    <td>${p.winrate}%</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">No matches yet.</td></tr>`;

        const recent = data.recent_matches || [];
        matches.innerHTML = recent.length
            ? recent.map(m => `
                <div class="match-row">
                    <div>
                        <strong>${esc(m.winner_login || "Unknown")}</strong>
                        <span style="color:var(--success);"> defeated </span>
                        <strong>${esc(m.loser_login || "Unknown")}</strong>
                    </div>
                    <div class="match-meta">
                        ${esc(String(m.game).toUpperCase())} · ${esc(m.created_at)}
                    </div>
                </div>
            `).join("")
            : `<div class="match-row">No matches yet.</div>`;

    } catch (error) {
        body.innerHTML = `<tr><td colspan="5">Failed to load stats.</td></tr>`;
        matches.innerHTML = `<div class="match-row">Failed to load match history.</div>`;
        console.error(error);
    }
})();

(async () => {
    const body = document.getElementById("leaderboard-body");
    const list = document.getElementById("match-list");
    const summaryPlayers = document.getElementById("summary-players");
    const summaryMatches = document.getElementById("summary-matches");
    const summaryTop = document.getElementById("summary-top");
    const summaryTopSub = document.getElementById("summary-top-sub");

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function modeName(value) {
        return {
            reaction: "REACTION",
            typing: "TYPING",
            cps: "CPS",
            aim: "AIM",
            blind: "BLIND",
        }[value] || String(value || "").toUpperCase();
    }

    function formatScore(game, score) {
        const value = Number(score);
        if (!Number.isFinite(value)) return "—";

        if (game === "reaction") {
            return value >= 999999 ? "FS" : `${value.toFixed(0)} ms`;
        }
        if (game === "typing") return `${value.toFixed(1)} WPM`;
        if (game === "cps") return `${value.toFixed(0)} clicks`;
        if (game === "aim") return `${value.toFixed(3)} t/s`;
        if (game === "blind") return `${(value / 1000).toFixed(3)}s`;
        return String(value);
    }

    function avatar(url, login) {
        if (url) {
            return `<img src="${escapeHtml(url)}" alt="">`;
        }
        const letter = escapeHtml((login || "?").slice(0, 1).toUpperCase());
        return `<span class="avatar-fallback">${letter}</span>`;
    }

    try {
        const response = await fetch("/api/stats", {
            headers: { "Accept": "application/json" }
        });
        const data = await response.json();

        const summary = data.summary || {};
        summaryPlayers.textContent = summary.players ?? 0;
        summaryMatches.textContent = summary.matches ?? 0;

        if (summary.top_player) {
            summaryTop.textContent = summary.top_player.login;
            summaryTopSub.textContent = `${summary.top_player.wins} побед · ${summary.top_player.losses} поражений`;
        } else {
            summaryTop.textContent = "—";
            summaryTopSub.textContent = "пока нет матчей";
        }

        const leaderboard = data.leaderboard || [];
        body.innerHTML = leaderboard.length
            ? leaderboard.map((player, index) => `
                <tr>
                    <td>
                        <span class="rank ${index < 3 ? `rank-${index + 1}` : ""}">
                            ${index + 1}
                        </span>
                    </td>
                    <td>
                        <div class="stats-user">
                            ${avatar(player.avatar_url, player.login)}
                            <div>
                                <strong>${escapeHtml(player.login)}</strong>
                                <small>${player.matches} matches</small>
                            </div>
                        </div>
                    </td>
                    <td>${player.matches}</td>
                    <td class="win-cell">${player.wins}</td>
                    <td>${player.losses}</td>
                    <td>
                        <div class="wr-cell">
                            <strong>${player.winrate}%</strong>
                            <span><i style="width:${Math.max(0, Math.min(100, player.winrate))}%"></i></span>
                        </div>
                    </td>
                </tr>
            `).join("")
            : `<tr><td colspan="6">Матчей пока нет.</td></tr>`;

        const matches = data.recent_matches || [];
        list.innerHTML = matches.length
            ? matches.map(match => `
                <article class="match-card">
                    <div class="match-mode">
                        <span>${escapeHtml(modeName(match.game))}</span>
                        <small>${escapeHtml(match.created_at)}</small>
                    </div>

                    <div class="match-player winner">
                        ${avatar(match.winner_avatar_url, match.winner_login)}
                        <div>
                            <small>WINNER</small>
                            <strong>${escapeHtml(match.winner_login)}</strong>
                        </div>
                    </div>

                    <div class="match-score">
                        <strong>${escapeHtml(formatScore(match.game, match.winner_score))}</strong>
                        <span>vs</span>
                        <strong>${escapeHtml(formatScore(match.game, match.loser_score))}</strong>
                    </div>

                    <div class="match-player loser">
                        ${avatar(match.loser_avatar_url, match.loser_login)}
                        <div>
                            <small>LOSER</small>
                            <strong>${escapeHtml(match.loser_login)}</strong>
                        </div>
                    </div>
                </article>
            `).join("")
            : `<div class="empty-state">Завершённых матчей пока нет.</div>`;

    } catch (error) {
        console.error(error);
        body.innerHTML = `<tr><td colspan="6">Не удалось загрузить статистику.</td></tr>`;
        list.innerHTML = `<div class="empty-state">Не удалось загрузить историю.</div>`;
    }
})();

/**
 * src/ui/screen/NotificationSection.js
 * NOTIFICATION RENDERER
 * Responsibilities:
 * - Renders dynamic notification list from AppState
 * - Handles Empty State
 */

import { AppState } from '../../core/AppState.js';

export const NotificationSection = {
    _getList: () => document.getElementById('notificationList'),

    init() {
        console.log('[NotificationSection] Initializing...');
        // Initial Render
        this.render(AppState.state.notifications);

        // Subscribe
        AppState.subscribe((state) => {
            if (state.notifications) {
                this.render(state.notifications);
            }
        });
    },

    render(notifications) {
        const list = this._getList();
        if (!list) return;

        list.innerHTML = '';

        // 1. Empty State
        if (!notifications || notifications.length === 0) {
            list.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: rgba(0,0,0,0.4); text-align: center;">
                    <span style="font-size: 24px; margin-bottom: 8px;">🔔</span>
                    <span style="font-size: 14px; font-weight: 500;">No notifications yet</span>
                </div>
            `;
            return;
        }

        // 2. Render Cards
        notifications.forEach(n => {
            const card = document.createElement('div');
            card.className = 'notif-card';
            if (n.read) card.style.opacity = '0.6';

            // Determine Icon logic (simplified)
            let iconSrc = 'assets/eth.png';
            let iconStyle = '';

            if (n.type === 'sol') {
                iconSrc = 'assets/sol.png';
                iconStyle = 'background: rgba(20, 241, 149, 0.2); border-color: var(--sol-color);';
            } else if (n.type === 'btc') {
                iconSrc = 'assets/btc.png';
                iconStyle = 'background: rgba(247, 147, 26, 0.2); border-color: var(--btc-color);';
            }

            card.innerHTML = `
                <div class="notif-icon" style="${iconStyle}">
                    <img src="${iconSrc}" style="width:20px; height:20px; object-fit:contain;">
                </div>
                <div class="notif-content">
                    <h4>${n.title}</h4>
                    <p>${n.message}</p>
                    <span class="notif-time">${n.time}</span>
                </div>
            `;
            list.appendChild(card);
        });
    }
};

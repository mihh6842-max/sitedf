console.log('App.js loaded - v16');

// ========== CONFIGURATION ==========
const CONFIG = {
    APP_NAME: 'P2P Platform',
    CURRENCIES: ['USD', 'KZT', 'RUB', 'EUR', 'CNY'],
    CITIES: ['Алматы', 'Астана', 'Шымкент', 'Актобе', 'Караганда', 'Атырау'],
    PAYMENT_METHODS: ['Перевод', 'Наличные', 'Договоренность']
};

// ========== FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyA8Eq2hppanj6TrvnD8PwU0d6sQO5y3gSc",
    authDomain: "dsklfmp.firebaseapp.com",
    databaseURL: "https://dsklfmp-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dsklfmp",
    storageBucket: "dsklfmp.firebasestorage.app",
    messagingSenderId: "907843304934",
    appId: "1:907843304934:web:df5cb8bcab6322d638aa27"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    console.log('Firebase connected');
} catch (e) {
    console.log('Firebase error:', e);
}

// ========== STATE ==========
let state = {
    user: null,
    myOffers: [],
    allOffers: [],
    myDeals: [],
    currentOffer: null,
    currentDeal: null
};

// ========== INITIALIZATION ==========
const tg = window.Telegram?.WebApp;

document.addEventListener('DOMContentLoaded', () => {
    initTelegram();
    initEventListeners();

    // Check policy acceptance
    const policyAccepted = localStorage.getItem('policyAccepted');
    if (policyAccepted === 'true') {
        showMainApp();
        loadState();
    } else {
        // Show welcome screen
        document.getElementById('welcomeScreen').classList.add('active');
        document.getElementById('mainApp').classList.remove('active');
    }
});

function initTelegram() {
    if (tg) {
        tg.ready();
        tg.expand();

        if (tg.initDataUnsafe?.user) {
            state.user = {
                id: 'user_' + tg.initDataUnsafe.user.id,
                telegram_id: tg.initDataUnsafe.user.id,
                name: tg.initDataUnsafe.user.first_name + (tg.initDataUnsafe.user.last_name ? ' ' + tg.initDataUnsafe.user.last_name : ''),
                username: tg.initDataUnsafe.user.username || 'user' + tg.initDataUnsafe.user.id,
                deals: 0,
                rating: 5.0
            };
        }
    }

    if (!state.user) {
        // Get or create stable demo user ID
        let demoId = localStorage.getItem('demo_user_id');
        if (!demoId) {
            demoId = 'demo_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('demo_user_id', demoId);
        }

        state.user = {
            id: 'user_' + demoId,
            telegram_id: demoId,
            name: 'Пользователь',
            username: demoId,
            deals: 0,
            rating: 5.0
        };
    }

    loadUserFromStorage();
}

function loadUserFromStorage() {
    const savedUser = localStorage.getItem('p2p_user');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        state.user.deals = userData.deals || 0;
        state.user.rating = userData.rating || 5.0;
    }
}

function saveUserToStorage() {
    localStorage.setItem('p2p_user', JSON.stringify({
        deals: state.user.deals,
        rating: state.user.rating
    }));
}

function loadState() {
    // Always load from localStorage first
    loadFromLocalStorage();

    if (db) {
        // Firebase real-time sync
        db.ref('offers').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state.allOffers = Object.values(data);
            }
            renderOffers();
        }, (error) => {
            console.error('Firebase offers error:', error);
            renderOffers();
        });

        db.ref('deals').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const allDeals = Object.values(data);
                state.myDeals = allDeals.filter(d =>
                    d.responder_user_id === state.user?.id || d.offer_user_id === state.user?.id
                );
            }
            renderMyDeals();
        }, (error) => {
            console.error('Firebase deals error:', error);
            renderMyDeals();
        });
    } else {
        renderOffers();
        renderMyDeals();
    }
}

function loadFromLocalStorage() {
    try {
        const savedOffers = localStorage.getItem('p2p_offers');
        if (savedOffers) {
            state.allOffers = JSON.parse(savedOffers);
        }

        const savedDeals = localStorage.getItem('p2p_deals');
        if (savedDeals) {
            state.myDeals = JSON.parse(savedDeals);
        }
    } catch (e) {
        console.error('LocalStorage error:', e);
    }
}

function syncData() {
    // Not needed with Firebase real-time
}

function saveState() {
    // Save to localStorage as backup
    localStorage.setItem('p2p_offers', JSON.stringify(state.allOffers));
    localStorage.setItem('p2p_deals', JSON.stringify(state.myDeals));
}

function initEventListeners() {
    const checkbox = document.getElementById('policyCheckbox');
    const startBtn = document.getElementById('startBtn');

    checkbox?.addEventListener('change', () => {
        startBtn.disabled = !checkbox.checked;
    });

    startBtn?.addEventListener('click', () => {
        localStorage.setItem('policyAccepted', 'true');
        showMainApp();
        loadState();
    });

    // Кнопка создания заявки
    const submitOfferBtn = document.getElementById('submitOfferBtn');
    if (submitOfferBtn) {
        submitOfferBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Submit offer button clicked');
            createOffer();
        });
    }
}

// ========== MAIN APP ==========
function showMainApp() {
    document.getElementById('welcomeScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    updateUI();
}

function updateUI() {
    updateProfile();
    loadRatesFromStorage();
    renderExchangeRates();
    renderOffers();
    loadNews();
}

// ========== NAVIGATION ==========
function switchView(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    document.querySelectorAll('#mainApp > .view').forEach(v => v.classList.remove('active'));

    if (view === 'home') {
        document.getElementById('homeView').classList.add('active');
        document.getElementById('headerTitle').textContent = 'P2P Platform';
        loadRatesFromStorage();
        renderExchangeRates();
        loadNews();
    } else if (view === 'offers') {
        document.getElementById('offersView').classList.add('active');
        document.getElementById('headerTitle').textContent = 'Заявки';
        renderOffers();
    } else if (view === 'myDeals') {
        document.getElementById('myDealsView').classList.add('active');
        document.getElementById('headerTitle').textContent = 'Мои сделки';
        renderMyDeals();
    } else if (view === 'profile') {
        document.getElementById('profileView').classList.add('active');
        document.getElementById('headerTitle').textContent = 'Профиль';
        updateProfile();
    }
}

// ========== PROFILE ==========
function updateProfile() {
    const avatar = state.user.name[0].toUpperCase();
    document.getElementById('profileAvatar').textContent = avatar;
    document.getElementById('profileName').textContent = state.user.name;
    document.getElementById('profileUsername').textContent = '@' + state.user.username;
    document.getElementById('profileDeals').textContent = state.user.deals || 0;
    document.getElementById('profileRating').textContent = state.user.rating?.toFixed(1) || '5.0';
    updateSubscriptionUI();
    checkAdmin();
}

// ========== EXCHANGE RATES ==========
let EXCHANGE_RATES = {
    'USD/KZT': { buy: 503, sell: 508 },
    'EUR/KZT': { buy: 520, sell: 528 },
    'RUB/KZT': { buy: 4.98, sell: 5.00 },
    'CNY/KZT': { buy: 69, sell: 71 }
};

async function fetchExchangeRates() {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();

        const kztRate = data.rates.KZT;
        const eurRate = data.rates.EUR;
        const rubRate = data.rates.RUB;
        const cnyRate = data.rates.CNY;

        EXCHANGE_RATES = {
            'USD/KZT': {
                buy: Math.round(kztRate * 0.99 * 100) / 100,
                sell: Math.round(kztRate * 1.01 * 100) / 100
            },
            'EUR/KZT': {
                buy: Math.round((kztRate / eurRate) * 0.99 * 100) / 100,
                sell: Math.round((kztRate / eurRate) * 1.01 * 100) / 100
            },
            'RUB/KZT': {
                buy: Math.round((kztRate / rubRate) * 0.99 * 100) / 100,
                sell: Math.round((kztRate / rubRate) * 1.01 * 100) / 100
            },
            'CNY/KZT': {
                buy: Math.round((kztRate / cnyRate) * 0.99 * 100) / 100,
                sell: Math.round((kztRate / cnyRate) * 1.01 * 100) / 100
            }
        };

        localStorage.setItem('exchange_rates', JSON.stringify({
            rates: EXCHANGE_RATES,
            timestamp: Date.now()
        }));

        renderExchangeRates();
        updateAllOffersRates();
    } catch (error) {
        console.error('Failed to fetch rates:', error);
    }
}

function loadRatesFromStorage() {
    const saved = localStorage.getItem('exchange_rates');
    if (saved) {
        const data = JSON.parse(saved);
        const hourAgo = Date.now() - (60 * 60 * 1000);

        if (data.timestamp > hourAgo) {
            EXCHANGE_RATES = data.rates;
        } else {
            fetchExchangeRates();
        }
    } else {
        fetchExchangeRates();
    }
}

function updateAllOffersRates() {
    state.allOffers.forEach(offer => {
        const pair = `${offer.from_currency}/${offer.to_currency}`;
        if (EXCHANGE_RATES[pair]) {
            const avgRate = (EXCHANGE_RATES[pair].buy + EXCHANGE_RATES[pair].sell) / 2;
            offer.rate = Math.round(avgRate * 100) / 100;
        }
    });
    saveState();
    renderOffers();
}

function renderExchangeRates() {
    const container = document.getElementById('exchangeRates');
    if (!container) return;

    container.innerHTML = Object.entries(EXCHANGE_RATES).map(([pair, rates]) => {
        const [from, to] = pair.split('/');
        return `
            <div class="rate-card">
                <div class="rate-pair">${from} / ${to}</div>
                <div class="rate-values">
                    <div class="rate-item">
                        <span class="rate-label">Покупка</span>
                        <span class="rate-value">${rates.buy}</span>
                    </div>
                    <div class="rate-item">
                        <span class="rate-label">Продажа</span>
                        <span class="rate-value">${rates.sell}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

setInterval(fetchExchangeRates, 60 * 60 * 1000);

// ========== NEWS ==========
let newsData = [];

function loadNews() {
    if (db) {
        db.ref('news').orderByChild('created_at').limitToLast(20).on('value', snapshot => {
            newsData = [];
            snapshot.forEach(child => {
                newsData.unshift({ id: child.key, ...child.val() });
            });
            newsData.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.created_at - a.created_at;
            });
            updateNewsBanner();
        });
    } else {
        newsData = [
            {
                id: '1',
                type: 'update',
                title: '🚀 Обновление платформы v2.0',
                text: 'Добавлены PRO-тарифы и продвижение заявок!\n\n✅ Поднять в топ\n✅ Выделить цветом\n✅ Закрепить на 24 часа\n\nТеперь ваши заявки будут заметнее!',
                created_at: Date.now() / 1000,
                pinned: true,
                views: 1247
            },
            {
                id: '2',
                type: 'info',
                title: '🔒 Правила безопасности',
                text: 'Напоминаем важные правила:\n\n• Всегда проверяйте рейтинг контрагента\n• Не переводите деньги до подтверждения\n• Используйте встроенный чат\n• При проблемах обращайтесь в арбитраж',
                created_at: (Date.now() - 86400000) / 1000,
                views: 892
            },
            {
                id: '3',
                type: 'promo',
                title: '🎁 Приглашай друзей',
                text: 'Расскажите о платформе друзьям и получайте бонусы!\n\nКаждый приглашённый пользователь = +1 бесплатная сделка',
                created_at: (Date.now() - 172800000) / 1000,
                views: 654
            }
        ];
        updateNewsBanner();
    }
}

function updateNewsBanner() {
    const lastSeen = parseInt(localStorage.getItem('lastNewsSeenAt') || '0');
    const newCount = newsData.filter(n => n.created_at * 1000 > lastSeen).length;

    const titleEl = document.getElementById('bannerNewsTitle');
    const countEl = document.getElementById('bannerNewsCount');

    if (newsData.length > 0 && titleEl) {
        const latest = newsData[0];
        titleEl.textContent = latest.title.substring(0, 30) + (latest.title.length > 30 ? '...' : '');
    }

    if (countEl) {
        countEl.textContent = newCount > 0 ? `${newCount} новых` : `${newsData.length} записей`;
    }
}

function openNewsModal() {
    openModal('newsModal');
    renderNewsModal();
    localStorage.setItem('lastNewsSeenAt', Date.now().toString());
    updateNewsBanner();
    incrementNewsViews();
}

function incrementNewsViews() {
    if (!db) return;
    newsData.forEach(news => {
        const viewsRef = db.ref('news/' + news.id + '/views');
        viewsRef.transaction((current) => {
            return (current || 0) + 1;
        });
    });
}

function renderNewsModal() {
    const container = document.getElementById('newsModalList');
    if (!container) return;

    if (newsData.length === 0) {
        container.innerHTML = `
            <div class="news-empty">
                <div class="news-empty-icon">📭</div>
                <div>Новостей пока нет</div>
            </div>
        `;
        return;
    }

    container.innerHTML = newsData.map(news => {
        const date = new Date(news.created_at * 1000);
        const timeStr = formatNewsTime(date);
        const views = news.views || 0;
        const commentsCount = news.commentsData ? Object.keys(news.commentsData).length : 0;

        return `
            <div class="news-item">
                <div class="news-item-avatar">📢</div>
                <div class="news-item-content">
                    <div class="news-item-header">
                        <span class="news-item-name">P2P Platform</span>
                        ${news.pinned ? '<span class="news-item-pin">📌</span>' : ''}
                    </div>
                    <div class="news-bubble">
                        <div class="news-bubble-title">${escapeHtml(news.title)}</div>
                        <div class="news-bubble-text">${escapeHtml(news.text)}</div>
                        ${news.image ? `<img src="${news.image}" class="news-bubble-image" alt="">` : ''}
                    </div>
                    <div class="news-item-meta">
                        <span class="news-meta-time">${timeStr}</span>
                        <span class="news-meta-views">👁 ${views}</span>
                    </div>
                    <button class="news-comment-btn" onclick="openComments('${news.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>${commentsCount} комментариев</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function formatNewsTime(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
        return 'сегодня в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

let currentNewsId = null;

function openComments(newsId) {
    currentNewsId = newsId;
    openModal('commentsModal');
    loadComments(newsId);
}

function loadComments(newsId) {
    if (!db) return;

    const commentsRef = db.ref('news/' + newsId + '/commentsData');
    commentsRef.on('value', (snapshot) => {
        const comments = snapshot.val() || {};
        renderComments(comments);
    });
}

function renderComments(comments) {
    const container = document.getElementById('commentsList');
    if (!container) return;

    const commentsArray = Object.entries(comments).map(([id, comment]) => ({
        id,
        ...comment
    })).sort((a, b) => a.timestamp - b.timestamp);

    if (commentsArray.length === 0) {
        container.innerHTML = `
            <div class="comments-empty">
                <div class="comments-empty-icon">💬</div>
                <div>Нет комментариев</div>
                <div class="comments-empty-text">Будьте первым!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = commentsArray.map(comment => {
        const date = new Date(comment.timestamp);
        const timeStr = formatCommentTime(date);

        return `
            <div class="comment-item">
                <div class="comment-avatar">${comment.userName.charAt(0).toUpperCase()}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-name">${escapeHtml(comment.userName)}</span>
                        <span class="comment-time">${timeStr}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                </div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function formatCommentTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function sendComment() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();

    if (!text) {
        showToast('Введите комментарий');
        return;
    }

    if (!db || !currentNewsId) return;

    const comment = {
        text: text,
        userName: state.user.name,
        userId: state.user.id,
        timestamp: Date.now()
    };

    const commentsRef = db.ref('news/' + currentNewsId + '/commentsData');
    commentsRef.push(comment).then(() => {
        input.value = '';
        showToast('Комментарий добавлен');
    }).catch(err => {
        showToast('Ошибка: ' + err.message);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== CREATE OFFER ==========
function showCreateOffer() {
    openModal('createOfferModal');
    populateCurrencySelects();
    populateCitySelect();
    populatePaymentMethodSelect();
}

function populateCurrencySelects() {
    const fromSelect = document.getElementById('offerFromCurrency');
    const toSelect = document.getElementById('offerToCurrency');

    const options = CONFIG.CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;

    fromSelect.value = 'USD';
    toSelect.value = 'KZT';
}

function populateCitySelect() {
    const select = document.getElementById('offerCity');
    select.innerHTML = CONFIG.CITIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

function populatePaymentMethodSelect() {
    const select = document.getElementById('offerPaymentMethod');
    select.innerHTML = CONFIG.PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('');
}

function createOffer() {
    try {
        console.log('createOffer called');
        console.log('state.user:', state.user);

        if (!state.user) {
            alert('Ошибка: пользователь не инициализирован');
            return;
        }

        const fromCurrency = document.getElementById('offerFromCurrency')?.value;
        const toCurrency = document.getElementById('offerToCurrency')?.value;
        const amount = parseFloat(document.getElementById('offerAmount')?.value || 0);
        const rate = parseFloat(document.getElementById('offerRate')?.value || 0);
        const city = document.getElementById('offerCity')?.value;
        const paymentMethod = document.getElementById('offerPaymentMethod')?.value;

        console.log('Form values:', { fromCurrency, toCurrency, amount, rate, city, paymentMethod });

        if (!amount || amount <= 0) {
            showToast('Введите сумму', 'error');
            return;
        }

        if (!rate || rate <= 0) {
            showToast('Введите курс', 'error');
            return;
        }

        if (fromCurrency === toCurrency) {
            showToast('Выберите разные валюты', 'error');
            return;
        }

        const offer = {
            id: 'offer_' + Date.now() + '_' + state.user.id,
            user_id: state.user.id,
            user_name: state.user.name,
            username: state.user.username,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            amount,
            rate,
            city,
            payment_method: paymentMethod,
            rating: state.user.rating,
            deals: state.user.deals,
            created_at: Math.floor(Date.now() / 1000),
            status: 'active'
        };

        console.log('Creating offer:', offer);

        if (db) {
            db.ref('offers/' + offer.id).set(offer).then(() => {
                console.log('Offer saved to Firebase');
                closeModal('createOfferModal');
                showToast('Заявка создана', 'success');
                switchView('offers');
            }).catch(err => {
                console.error('Firebase error:', err);
                saveOfferLocally(offer);
            });
        } else {
            console.log('No Firebase, saving locally');
            saveOfferLocally(offer);
        }
    } catch (err) {
        console.error('createOffer error:', err);
        alert('Ошибка: ' + err.message);
    }
}

function saveOfferLocally(offer) {
    console.log('saveOfferLocally called');
    state.allOffers.unshift(offer);

    try {
        const saved = localStorage.getItem('p2p_offers') || '[]';
        const offers = JSON.parse(saved);
        offers.unshift(offer);
        localStorage.setItem('p2p_offers', JSON.stringify(offers));
        console.log('Offer saved to localStorage');
    } catch (e) {
        console.error('localStorage error:', e);
    }

    closeModal('createOfferModal');
    showToast('Заявка создана', 'success');
    renderOffers();
    switchView('offers');
}

// ========== OFFERS LIST ==========
function renderOffers() {
    const list = document.getElementById('offersList');
    const empty = document.getElementById('emptyOffers');

    if (!list) return;

    const offers = state.allOffers.filter(o => o.status === 'active' && o.user_id !== state.user.id);

    if (offers.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = offers.map(offer => `
        <div class="offer-card" onclick="viewOffer('${offer.id}')">
            <div class="offer-header">
                <div class="offer-user">
                    <div class="avatar">${offer.user_name[0].toUpperCase()}</div>
                    <div class="offer-user-info">
                        <span class="offer-user-name">${offer.user_name}</span>
                        <span class="offer-user-stats">⭐ ${offer.rating.toFixed(1)} · ${offer.deals} сделок</span>
                    </div>
                </div>
            </div>
            <div class="offer-body">
                <div class="offer-pair">${offer.from_currency} → ${offer.to_currency}</div>
                <div class="offer-details">
                    <div class="offer-detail">
                        <span class="offer-detail-label">Сумма</span>
                        <span class="offer-detail-value">${offer.amount} ${offer.from_currency}</span>
                    </div>
                    <div class="offer-detail">
                        <span class="offer-detail-label">Курс</span>
                        <span class="offer-detail-value">${offer.rate}</span>
                    </div>
                    <div class="offer-detail">
                        <span class="offer-detail-label">Город</span>
                        <span class="offer-detail-value">${offer.city}</span>
                    </div>
                    <div class="offer-detail">
                        <span class="offer-detail-label">Способ</span>
                        <span class="offer-detail-value">${offer.payment_method}</span>
                    </div>
                </div>
            </div>
            <div class="offer-footer">
                <span class="offer-time">${formatTime(offer.created_at * 1000)}</span>
                <button class="btn-small btn-primary" onclick="event.stopPropagation(); respondToOffer('${offer.id}')">Откликнуться</button>
            </div>
        </div>
    `).join('');
}

function viewOffer(offerId) {
    const offer = state.allOffers.find(o => o.id === offerId);
    if (!offer) return;

    state.currentOffer = offer;
    openModal('viewOfferModal');

    document.getElementById('viewOfferUser').textContent = offer.user_name;
    document.getElementById('viewOfferRating').textContent = `⭐ ${offer.rating.toFixed(1)} · ${offer.deals} сделок`;
    document.getElementById('viewOfferPair').textContent = `${offer.from_currency} → ${offer.to_currency}`;
    document.getElementById('viewOfferAmount').textContent = `${offer.amount} ${offer.from_currency}`;
    document.getElementById('viewOfferRate').textContent = offer.rate;
    document.getElementById('viewOfferCity').textContent = offer.city;
    document.getElementById('viewOfferMethod').textContent = offer.payment_method;
    document.getElementById('viewOfferTime').textContent = formatDate(offer.created_at * 1000);
}

function respondToCurrentOffer() {
    if (!state.currentOffer) {
        alert('Заявка не выбрана');
        return;
    }
    respondToOffer(state.currentOffer.id);
}

function respondToOffer(offerId) {
    // Проверка лимита для Free пользователей
    if (!checkDealLimit()) return;

    const offer = state.allOffers.find(o => o.id === offerId);
    if (!offer) {
        alert('Заявка не найдена');
        return;
    }

    showConfirm(
        'Откликнуться на заявку?',
        `Вы начнете сделку с ${offer.user_name}. Деньги переводятся напрямую вне сервиса.`,
        () => {
            console.log('Confirm callback executed');
            const deal = {
                id: 'deal_' + Date.now() + '_' + state.user.id,
                offer_id: offer.id,
                offer_user_id: offer.user_id,
                offer_user_name: offer.user_name,
                offer_username: offer.username,
                responder_user_id: state.user.id,
                responder_user_name: state.user.name,
                from_currency: offer.from_currency,
                to_currency: offer.to_currency,
                amount: offer.amount,
                rate: offer.rate,
                city: offer.city,
                payment_method: offer.payment_method,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000)
            };
            console.log('Deal created:', deal);

            if (db) {
                console.log('Saving to Firebase...');
                db.ref('deals/' + deal.id).set(deal).then(() => {
                    console.log('Deal saved, updating offer status...');
                    return db.ref('offers/' + offer.id + '/status').set('in_deal');
                }).then(() => {
                    console.log('All saved, opening deal');
                    state.myDeals.push(deal);
                    showToast('Вы откликнулись на заявку', 'success');
                    openDeal(deal.id);
                }).catch(err => {
                    console.error('Firebase error:', err);
                    showToast('Ошибка: ' + err.message, 'error');
                });
            } else {
                console.log('No Firebase, saving locally');
                state.myDeals.push(deal);
                offer.status = 'in_deal';
                showToast('Вы откликнулись на заявку', 'success');
                renderOffers();
                openDeal(deal.id);
            }
        }
    );
}

// ========== DEAL VIEW ==========
let chatListener = null;

function openDeal(dealId) {
    const deal = state.myDeals.find(d => d.id === dealId);
    if (!deal) return;

    state.currentDeal = deal;
    closeModal('viewOfferModal');

    document.querySelectorAll('#mainApp > .view').forEach(v => v.classList.remove('active'));
    document.getElementById('dealView').classList.add('active');

    // Header
    document.getElementById('dealHeaderName').textContent = deal.offer_user_name;
    updateDealStatus();
    loadChat();
}

function updateDealStatus() {
    const statusText = state.currentDeal.status === 'completed' ? 'Завершена' : 'Ожидает подтверждения';
    document.getElementById('dealHeaderStatus').textContent = statusText;
}

function showDealInfo() {
    const deal = state.currentDeal;
    if (!deal) return;

    document.getElementById('dealInfoAvatar').textContent = deal.offer_user_name[0].toUpperCase();
    document.getElementById('dealInfoName').textContent = deal.offer_user_name;
    document.getElementById('dealInfoUsername').textContent = '@' + deal.offer_username;
    document.getElementById('dealInfoPair').textContent = `${deal.from_currency} → ${deal.to_currency}`;
    document.getElementById('dealInfoAmount').textContent = `${deal.amount} ${deal.from_currency}`;
    document.getElementById('dealInfoRate').textContent = deal.rate;
    document.getElementById('dealInfoCity').textContent = deal.city;
    document.getElementById('dealInfoMethod').textContent = deal.payment_method;

    const statusEl = document.getElementById('dealInfoStatus');
    if (deal.status === 'completed') {
        statusEl.textContent = 'Завершена';
        statusEl.classList.add('completed');
    } else {
        statusEl.textContent = 'Ожидает';
        statusEl.classList.remove('completed');
    }

    document.getElementById('dealInfoSheet').classList.add('active');
}

function closeDealInfo() {
    document.getElementById('dealInfoSheet').classList.remove('active');
}

function openTelegramChat() {
    const username = state.currentDeal.offer_username;
    if (tg) {
        tg.openTelegramLink(`https://t.me/${username}`);
    } else {
        window.open(`https://t.me/${username}`, '_blank');
    }
}

function completeDeal() {
    closeDealInfo();
    showConfirm(
        'Завершить сделку?',
        'Подтвердите, что сделка прошла успешно',
        () => {
            // Показать окно сервисного сбора
            showServiceFee(state.currentDeal.id);
        }
    );
}

function reportDeal() {
    closeDealInfo();
    showConfirm(
        'Пожаловаться на пользователя?',
        'Администратор рассмотрит вашу жалобу',
        () => {
            showToast('Жалоба отправлена');
        }
    );
}

function backFromDeal() {
    // Unsubscribe from chat
    if (chatListener && db) {
        db.ref('chats/' + state.currentDeal?.id).off('value', chatListener);
        chatListener = null;
    }

    document.getElementById('dealView').classList.remove('active');
    document.getElementById('myDealsView').classList.add('active');
    state.currentDeal = null;
}

// ========== CHAT ==========
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingStartTime = 0;

function loadChat() {
    if (!state.currentDeal || !db) {
        renderChat([]);
        return;
    }

    const chatRef = db.ref('chats/' + state.currentDeal.id);

    if (chatListener) {
        chatRef.off('value', chatListener);
    }

    chatListener = chatRef.on('value', (snapshot) => {
        const messages = snapshot.val();
        const msgArray = messages ? Object.values(messages).sort((a, b) => a.timestamp - b.timestamp) : [];
        renderChat(msgArray);
    });

    const input = document.getElementById('chatInput');
    input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    // File input handler
    document.getElementById('chatFileInput').onchange = handleImageUpload;
}

function renderChat(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <div class="chat-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h4>Начните общение</h4>
                <p>Договоритесь о деталях сделки</p>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMine = msg.user_id === state.user?.id;
        const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        // Image message
        if (msg.type === 'image') {
            return `
                <div class="chat-message ${isMine ? 'mine' : 'other'} has-image">
                    <div class="message-image" onclick="openImagePreview('${msg.imageUrl}')">
                        <img src="${msg.imageUrl}" alt="Photo">
                        <div class="message-image-overlay">
                            <span class="message-time">${time}</span>
                            ${isMine ? '<span class="message-status">✓✓</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // Voice message
        if (msg.type === 'voice') {
            const waveformBars = generateWaveformBars(msg.waveform || []);
            return `
                <div class="chat-message ${isMine ? 'mine' : 'other'} voice-message">
                    ${!isMine ? `<div class="message-sender">${escapeHtml(msg.user_name)}</div>` : ''}
                    <div class="voice-player" data-audio="${msg.audioUrl}">
                        <button class="voice-play-btn" onclick="toggleVoice(this)">
                            <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            <svg class="pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                            </svg>
                        </button>
                        <div class="voice-waveform">${waveformBars}</div>
                        <span class="voice-duration">${msg.duration || '0:00'}</span>
                    </div>
                    <div class="message-footer">
                        <span class="message-time">${time}</span>
                        ${isMine ? '<span class="message-status">✓✓</span>' : ''}
                    </div>
                </div>
            `;
        }

        // Text message
        return `
            <div class="chat-message ${isMine ? 'mine' : 'other'}">
                ${!isMine ? `<div class="message-sender">${escapeHtml(msg.user_name)}</div>` : ''}
                <div class="message-text">${escapeHtml(msg.text)}</div>
                <div class="message-footer">
                    <span class="message-time">${time}</span>
                    ${isMine ? '<span class="message-status">✓✓</span>' : ''}
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function generateWaveformBars(waveform) {
    const defaultWaveform = Array(20).fill(0).map(() => Math.random() * 20 + 8);
    const bars = waveform.length ? waveform : defaultWaveform;
    return bars.map(h => `<div class="bar" style="height:${h}px"></div>`).join('');
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || !state.currentDeal || !db) return;

    const message = {
        id: 'msg_' + Date.now(),
        type: 'text',
        deal_id: state.currentDeal.id,
        user_id: state.user.id,
        user_name: state.user.name,
        text: text,
        timestamp: Date.now()
    };

    db.ref('chats/' + state.currentDeal.id + '/' + message.id).set(message)
        .then(() => { input.value = ''; })
        .catch(() => showToast('Ошибка отправки', 'error'));
}

// Image upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file || !state.currentDeal || !db) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Файл слишком большой (макс 5MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const message = {
            id: 'msg_' + Date.now(),
            type: 'image',
            deal_id: state.currentDeal.id,
            user_id: state.user.id,
            user_name: state.user.name,
            imageUrl: reader.result,
            timestamp: Date.now()
        };

        db.ref('chats/' + state.currentDeal.id + '/' + message.id).set(message)
            .catch(() => showToast('Ошибка отправки фото', 'error'));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function openImagePreview(url) {
    document.getElementById('previewImage').src = url;
    document.getElementById('imagePreviewModal').classList.add('active');
}

function closeImagePreview() {
    document.getElementById('imagePreviewModal').classList.remove('active');
}

// Voice recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();

        document.getElementById('voiceBtn').classList.add('recording');
        document.getElementById('recordingOverlay').style.display = 'flex';

        // Generate waveform bars
        const waveform = document.getElementById('recordingWaveform');
        waveform.innerHTML = Array(30).fill(0).map(() =>
            `<div class="bar" style="height:${Math.random() * 20 + 10}px; animation-delay:${Math.random() * 0.5}s"></div>`
        ).join('');

        recordingInterval = setInterval(updateRecordingTime, 100);
    } catch (err) {
        showToast('Нет доступа к микрофону', 'error');
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('recordingTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());

    clearInterval(recordingInterval);
    document.getElementById('voiceBtn').classList.remove('recording');
}

function cancelRecording() {
    stopRecording();
    audioChunks = [];
    document.getElementById('recordingOverlay').style.display = 'none';
}

function sendVoiceMessage() {
    if (audioChunks.length === 0 || !state.currentDeal || !db) {
        cancelRecording();
        return;
    }

    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();

    reader.onload = () => {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;

        const message = {
            id: 'msg_' + Date.now(),
            type: 'voice',
            deal_id: state.currentDeal.id,
            user_id: state.user.id,
            user_name: state.user.name,
            audioUrl: reader.result,
            duration: `${mins}:${secs.toString().padStart(2, '0')}`,
            waveform: Array(20).fill(0).map(() => Math.random() * 20 + 8),
            timestamp: Date.now()
        };

        db.ref('chats/' + state.currentDeal.id + '/' + message.id).set(message)
            .catch(() => showToast('Ошибка отправки', 'error'));
    };

    reader.readAsDataURL(blob);
    audioChunks = [];
    document.getElementById('recordingOverlay').style.display = 'none';
}

// Voice playback
let currentAudio = null;

function toggleVoice(btn) {
    const player = btn.closest('.voice-player');
    const audioUrl = player.dataset.audio;
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    const waveform = player.querySelector('.voice-waveform');

    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        document.querySelectorAll('.voice-play-btn').forEach(b => {
            b.querySelector('.play-icon').style.display = 'block';
            b.querySelector('.pause-icon').style.display = 'none';
        });
        document.querySelectorAll('.voice-waveform').forEach(w => w.classList.remove('playing'));

        if (currentAudio.src === audioUrl) {
            currentAudio = null;
            return;
        }
    }

    currentAudio = new Audio(audioUrl);
    currentAudio.play();

    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    waveform.classList.add('playing');

    currentAudio.onended = () => {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        waveform.classList.remove('playing');
        currentAudio = null;
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== MY DEALS ==========
function renderMyDeals() {
    const list = document.getElementById('myDealsList');
    const empty = document.getElementById('emptyDeals');

    if (!list) return;

    if (state.myDeals.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = state.myDeals.slice().reverse().map(deal => `
        <div class="deal-card" onclick="openDeal('${deal.id}')">
            <div class="deal-header">
                <span class="deal-pair">${deal.from_currency} → ${deal.to_currency}</span>
                <span class="deal-status deal-status-${deal.status}">${getDealStatusText(deal.status)}</span>
            </div>
            <div class="deal-body">
                <div class="deal-user">
                    <span class="deal-user-name">${deal.offer_user_name}</span>
                    <span class="deal-user-username">@${deal.offer_username}</span>
                </div>
                <div class="deal-info">
                    <span>${deal.amount} ${deal.from_currency} · Курс ${deal.rate}</span>
                    <span>${deal.city} · ${deal.payment_method}</span>
                </div>
            </div>
            <div class="deal-footer">
                <span class="deal-time">${formatDate(deal.created_at * 1000)}</span>
            </div>
        </div>
    `).join('');
}

function getDealStatusText(status) {
    const texts = {
        pending: 'В процессе',
        completed: 'Завершена',
        disputed: 'Спор'
    };
    return texts[status] || status;
}

// ========== MY OFFERS ==========
function showMyOffers() {
    openModal('myOffersModal');
    renderMyOffers();
}

function renderMyOffers() {
    const list = document.getElementById('myOffersList');
    if (!list) return;

    const myOffers = state.allOffers.filter(o => o.user_id === state.user.id);

    if (myOffers.length === 0) {
        list.innerHTML = '<div class="empty-message">У вас нет активных заявок</div>';
        return;
    }

    list.innerHTML = myOffers.map(offer => `
        <div class="my-offer-card">
            <div class="my-offer-header">
                <span class="my-offer-pair">${offer.from_currency} → ${offer.to_currency}</span>
                <button class="btn-small btn-danger" onclick="deleteOffer('${offer.id}')">Удалить</button>
            </div>
            <div class="my-offer-body">
                <div>${offer.amount} ${offer.from_currency} · Курс ${offer.rate}</div>
                <div>${offer.city} · ${offer.payment_method}</div>
            </div>
            <div class="my-offer-footer">
                <span>${formatTime(offer.created_at * 1000)}</span>
            </div>
        </div>
    `).join('');
}

function deleteOffer(offerId) {
    showConfirm('Удалить заявку?', 'Это действие нельзя отменить', () => {
        state.allOffers = state.allOffers.filter(o => o.id !== offerId);
        state.myOffers = state.myOffers.filter(o => o.id !== offerId);
        saveState();
        renderMyOffers();
        renderOffers();
        showToast('Заявка удалена');
    });
}

// ========== MODALS ==========
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ========== TOAST ==========
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========== CONFIRM DIALOG ==========
let confirmCallback = null;

function showConfirm(title, text, callback) {
    console.log('showConfirm called:', title);
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmDialog').classList.add('active');
    console.log('confirmDialog active');
    confirmCallback = callback;

    const btn = document.getElementById('confirmBtn');
    btn.onclick = () => {
        const cb = confirmCallback;
        closeConfirm();
        if (cb) cb();
    };
}

function closeConfirm() {
    document.getElementById('confirmDialog').classList.remove('active');
    confirmCallback = null;
}

// ========== POLICY ==========
function showPolicy() {
    openModal('policyModal');
    document.getElementById('modalTitle').textContent = 'Политика конфиденциальности';
    document.getElementById('modalBody').innerHTML = `
        <h3>1. Общие положения</h3>
        <p>1.1. Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки и защиты персональных данных пользователей сервиса P2P Platform (далее — «Сервис»).</p>
        <p>1.2. Использование Сервиса означает безоговорочное согласие Пользователя с настоящей Политикой и указанными в ней условиями обработки его персональных данных.</p>
        <p>1.3. В случае несогласия с условиями Политики Пользователь должен прекратить использование Сервиса.</p>
        <p>1.4. Настоящая Политика применяется только к Сервису P2P Platform. Сервис не контролирует и не несет ответственность за сайты третьих лиц, на которые Пользователь может перейти по ссылкам, доступным в Сервисе.</p>

        <h3>2. Персональные данные пользователей</h3>
        <p>2.1. В рамках настоящей Политики под «персональными данными Пользователя» понимаются:</p>
        <p>2.1.1. Персональные данные, которые Пользователь предоставляет о себе самостоятельно при регистрации или в процессе использования Сервиса, включая персональные данные Пользователя из мессенджера Telegram.</p>
        <p>2.1.2. Данные, которые автоматически передаются Сервису в процессе его использования с помощью установленного на устройстве Пользователя программного обеспечения, в том числе IP-адрес, данные файлов cookie, информация о браузере Пользователя, технические характеристики оборудования и программного обеспечения.</p>

        <h3>3. Цели обработки персональных данных</h3>
        <p>3.1. Сервис собирает и хранит только те персональные данные, которые необходимы для предоставления услуг и функционирования Сервиса.</p>
        <p>3.2. Персональные данные Пользователя могут использоваться в следующих целях:</p>
        <p>3.2.1. Идентификация Пользователя в рамках Сервиса;</p>
        <p>3.2.2. Предоставление Пользователю доступа к персонализированным ресурсам Сервиса;</p>
        <p>3.2.3. Установление с Пользователем обратной связи, включая направление уведомлений, запросов, касающихся использования Сервиса;</p>
        <p>3.2.4. Улучшение качества Сервиса, удобства его использования, разработка новых сервисов и услуг;</p>
        <p>3.2.5. Проведение статистических и иных исследований на основе обезличенных данных.</p>

        <h3>4. Условия обработки персональных данных</h3>
        <p>4.1. Обработка персональных данных осуществляется с согласия Пользователя на обработку его персональных данных.</p>
        <p>4.2. Обработка персональных данных Пользователя осуществляется без ограничения срока любым законным способом, в том числе в информационных системах персональных данных с использованием средств автоматизации или без использования таких средств.</p>
        <p>4.3. Пользователь соглашается с тем, что Администрация вправе передавать персональные данные третьим лицам, в частности, курьерским службам, организациям почтовой связи, операторам электросвязи, исключительно в целях выполнения заказа Пользователя.</p>
        <p>4.4. Персональные данные Пользователя могут быть переданы уполномоченным органам государственной власти только по основаниям и в порядке, установленным законодательством.</p>

        <h3>5. Защита персональных данных</h3>
        <p>5.1. Администрация принимает необходимые и достаточные организационные и технические меры для защиты персональных данных Пользователя от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения, а также от иных неправомерных действий с ней третьих лиц.</p>

        <h3>6. Изменение Политики конфиденциальности</h3>
        <p>6.1. Администрация имеет право вносить изменения в настоящую Политику конфиденциальности. При внесении изменений в актуальной редакции указывается дата последнего обновления. Новая редакция Политики вступает в силу с момента ее размещения.</p>

        <h3>7. Обратная связь</h3>
        <p>7.1. Все предложения или вопросы по поводу настоящей Политики следует направлять через функционал Сервиса.</p>

        <p style="margin-top: 20px;"><strong>Дата последнего обновления: 18 января 2026 года</strong></p>
    `;
}

function showTerms() {
    openModal('policyModal');
    document.getElementById('modalTitle').textContent = 'Пользовательское соглашение';
    document.getElementById('modalBody').innerHTML = `
        <h3>1. Общие положения</h3>
        <p>1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между администрацией сервиса P2P Platform (далее — «Администрация») и пользователем сервиса (далее — «Пользователь»).</p>
        <p>1.2. Сервис P2P Platform (далее — «Сервис») представляет собой информационную платформу для поиска контрагентов по P2P сделкам между физическими лицами.</p>
        <p>1.3. Использование Сервиса регулируется настоящим Соглашением. Соглашение может быть изменено Администрацией без какого-либо специального уведомления, новая редакция Соглашения вступает в силу с момента ее размещения в Сервисе.</p>
        <p>1.4. Регистрируясь в Сервисе, Пользователь подтверждает, что ознакомился с условиями настоящего Соглашения и принимает их в полном объеме.</p>

        <h3>2. Предмет соглашения</h3>
        <p>2.1. Администрация предоставляет Пользователю право использования Сервиса в качестве информационной платформы для размещения объявлений об P2P сделках и поиска контрагентов.</p>
        <p>2.2. Все существующие на данный момент функции Сервиса, а также любое их развитие и/или добавление новых функций являются предметом настоящего Соглашения.</p>

        <h3>3. КРИТИЧЕСКИ ВАЖНО: Характер услуг</h3>
        <p><strong>3.1. СЕРВИС ЯВЛЯЕТСЯ ИСКЛЮЧИТЕЛЬНО ИНФОРМАЦИОННОЙ ПЛАТФОРМОЙ И НЕ ОКАЗЫВАЕТ ФИНАНСОВЫХ УСЛУГ.</strong></p>
        <p><strong>3.2. СЕРВИС НЕ ПРИНИМАЕТ, НЕ ХРАНИТ, НЕ ПЕРЕВОДИТ И НЕ ОБРАБАТЫВАЕТ ДЕНЕЖНЫЕ СРЕДСТВА ПОЛЬЗОВАТЕЛЕЙ.</strong></p>
        <p><strong>3.3. ВСЕ ФИНАНСОВЫЕ ОПЕРАЦИИ ОСУЩЕСТВЛЯЮТСЯ НАПРЯМУЮ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ ВНЕ СЕРВИСА.</strong></p>
        <p>3.4. Сервис не является стороной каких-либо сделок между Пользователями и не несет ответственности за их исполнение.</p>
        <p>3.5. Сервис не проверяет достоверность информации, размещаемой Пользователями, и не гарантирует ее точность.</p>

        <h3>4. Регистрация и учетная запись</h3>
        <p>4.1. Для использования Сервиса Пользователь должен пройти процедуру регистрации через мессенджер Telegram.</p>
        <p>4.2. Пользователь обязуется предоставлять достоверную и актуальную информацию при регистрации.</p>
        <p>4.3. Пользователь несет ответственность за безопасность своей учетной записи и все действия, совершенные под ней.</p>
        <p>4.4. Пользователь обязуется немедленно уведомить Администрацию о любом случае несанкционированного доступа к учетной записи.</p>

        <h3>5. Права и обязанности пользователя</h3>
        <p>5.1. Пользователь имеет право:</p>
        <p>5.1.1. Размещать объявления об P2P сделках;</p>
        <p>5.1.2. Просматривать объявления других Пользователей;</p>
        <p>5.1.3. Связываться с другими Пользователями через предоставленные контактные данные;</p>
        <p>5.1.4. Удалять свои объявления в любое время.</p>

        <p>5.2. Пользователь обязуется:</p>
        <p>5.2.1. Не размещать заведомо ложную информацию;</p>
        <p>5.2.2. Не использовать Сервис в противоправных целях;</p>
        <p>5.2.3. Не нарушать права третьих лиц при использовании Сервиса;</p>
        <p>5.2.4. Соблюдать законодательство при осуществлении P2P сделок;</p>
        <p>5.2.5. Не использовать Сервис для отмывания денежных средств или финансирования терроризма;</p>
        <p>5.2.6. Самостоятельно проверять контрагентов перед совершением сделок.</p>

        <h3>6. Права и обязанности администрации</h3>
        <p>6.1. Администрация обязуется:</p>
        <p>6.1.1. Обеспечивать функционирование Сервиса;</p>
        <p>6.1.2. Защищать персональные данные Пользователей в соответствии с Политикой конфиденциальности.</p>

        <p>6.2. Администрация имеет право:</p>
        <p>6.2.1. Изменять функционал Сервиса без предварительного уведомления;</p>
        <p>6.2.2. Удалять объявления, нарушающие настоящее Соглашение;</p>
        <p>6.2.3. Блокировать учетные записи Пользователей при нарушении условий Соглашения;</p>
        <p>6.2.4. Приостанавливать работу Сервиса для проведения технических работ.</p>

        <h3>7. Ответственность сторон</h3>
        <p>7.1. Администрация не несет ответственности за:</p>
        <p>7.1.1. Любые убытки, понесенные Пользователем в результате использования Сервиса;</p>
        <p>7.1.2. Действия или бездействие других Пользователей;</p>
        <p>7.1.3. Неисполнение обязательств по сделкам между Пользователями;</p>
        <p>7.1.4. Потерю денежных средств в результате сделок между Пользователями;</p>
        <p>7.1.5. Достоверность информации, размещенной Пользователями;</p>
        <p>7.1.6. Временную недоступность Сервиса по техническим причинам.</p>

        <p>7.2. Пользователь несет полную ответственность за:</p>
        <p>7.2.1. Соблюдение законодательства при использовании Сервиса;</p>
        <p>7.2.2. Достоверность размещаемой информации;</p>
        <p>7.2.3. Все сделки, совершенные с использованием Сервиса;</p>
        <p>7.2.4. Проверку контрагентов перед совершением сделок.</p>

        <h3>8. Интеллектуальная собственность</h3>
        <p>8.1. Все объекты, доступные при помощи Сервиса, в том числе элементы дизайна, текст, графические изображения, иллюстрации, программы, являются объектами исключительных прав Администрации.</p>
        <p>8.2. Использование объектов интеллектуальной собственности возможно только в рамках функционала, предлагаемого Сервисом.</p>

        <h3>9. Разрешение споров</h3>
        <p>9.1. В случае возникновения споров между Пользователем и Администрацией стороны обязуются использовать досудебный порядок урегулирования.</p>
        <p>9.2. При недостижении согласия споры разрешаются в судебном порядке в соответствии с законодательством.</p>

        <h3>10. Заключительные положения</h3>
        <p>10.1. Настоящее Соглашение составлено на русском языке и может быть предоставлено Пользователю для ознакомления на другом языке. В случае расхождения русскоязычной версии Соглашения и версии на ином языке, применяются положения русскоязычной версии.</p>
        <p>10.2. Признание судом какого-либо положения Соглашения недействительным не влечет недействительности иных положений.</p>
        <p>10.3. Бездействие со стороны Администрации в случае нарушения Пользователем положений Соглашения не лишает Администрацию права предпринять соответствующие действия позднее.</p>

        <h3>11. Согласие на обработку персональных данных</h3>
        <p>11.1. Принимая настоящее Соглашение, Пользователь дает согласие на обработку своих персональных данных в соответствии с Политикой конфиденциальности.</p>
        <p>11.2. Обработка персональных данных осуществляется в целях исполнения настоящего Соглашения.</p>

        <p style="margin-top: 20px;"><strong>Дата последнего обновления: 18 января 2026 года</strong></p>
    `;
}

// ========== RESET ==========
function resetData() {
    showConfirm('Сбросить все данные?', 'Это действие нельзя отменить', () => {
        localStorage.clear();
        location.reload();
    });
}

// ========== UTILITIES ==========
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========== SUBSCRIPTION & PAYMENTS ==========
const PRICES = {
    pro: 5000,
    serviceFee: 300,
    promoTop: 300,
    promoHighlight: 200,
    promoPin: 500
};

function showSubscription() {
    openModal('subscriptionModal');
    updateSubscriptionUI();
}

function updateSubscriptionUI() {
    const isPro = state.user?.isPro;
    const card = document.getElementById('subscriptionCard');
    const title = document.getElementById('subTitle');
    const desc = document.getElementById('subDesc');

    if (isPro && card) {
        card.classList.add('pro');
        if (title) title.textContent = 'PRO-аккаунт';
        if (desc) desc.textContent = 'Безлимитные сделки • Активен';
    }
}

function buyPro() {
    initiatePayment('pro', PRICES.pro, 'PRO-подписка на месяц');
}

function showPromotionOptions() {
    openModal('promotionModal');
}

function buyPromotion(type) {
    const prices = {
        top: { amount: PRICES.promoTop, name: 'Поднять в топ' },
        highlight: { amount: PRICES.promoHighlight, name: 'Выделить цветом' },
        pin: { amount: PRICES.promoPin, name: 'Закрепить на 24 часа' }
    };
    const promo = prices[type];
    closeModal('promotionModal');
    initiatePayment('promo_' + type, promo.amount, promo.name);
}

function showDonate() {
    openModal('donateModal');
}

function donate(amount) {
    closeModal('donateModal');
    initiatePayment('donate', amount, 'Донат ' + amount + ' ₸');
}

function donateCustom() {
    const amount = prompt('Введите сумму в тенге:');
    if (amount && !isNaN(amount) && parseInt(amount) > 0) {
        closeModal('donateModal');
        initiatePayment('donate', parseInt(amount), 'Донат');
    }
}

function showServiceFee(dealId) {
    state.pendingFeeDealId = dealId;
    document.getElementById('feeAmount').textContent = PRICES.serviceFee + ' ₸';
    openModal('serviceFeeModal');
}

function payServiceFee() {
    closeModal('serviceFeeModal');
    initiatePayment('service_fee', PRICES.serviceFee, 'Сервисный сбор');
}

function initiatePayment(type, amount, description) {
    showConfirm(
        'Оплата: ' + description,
        'Сумма: ' + amount + ' ₸\n\nПерейти к оплате?',
        () => processPayment(type, amount)
    );
}

function processPayment(type, amount) {
    showToast('Переход к оплате...');
    // TODO: YooKassa интеграция
    setTimeout(() => onPaymentSuccess(type, amount), 1500);
}

function onPaymentSuccess(type, amount) {
    if (type === 'pro') {
        state.user.isPro = true;
        state.user.proExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        saveUserToStorage();
        updateSubscriptionUI();
        showToast('PRO-аккаунт активирован!', 'success');
    } else if (type === 'service_fee') {
        finalizeDealAfterFee();
    } else if (type.startsWith('promo_')) {
        applyPromotion(type.replace('promo_', ''));
    } else if (type === 'donate') {
        showToast('Спасибо за поддержку!', 'success');
    }
}

function finalizeDealAfterFee() {
    if (state.currentDeal) {
        state.currentDeal.status = 'completed';
        state.user.deals = (state.user.deals || 0) + 1;
        if (db) {
            db.ref('deals/' + state.currentDeal.id).update({ status: 'completed', feePaid: true });
        }
        saveUserToStorage();
        updateDealStatus();
        showToast('Сделка завершена!', 'success');
    }
}

function applyPromotion(type) {
    const myOffer = state.allOffers.find(o => o.user_id === state.user.id && o.status === 'active');
    if (!myOffer) {
        showToast('У вас нет активных заявок', 'error');
        return;
    }
    const updates = {};
    if (type === 'top') updates.boostedAt = Date.now();
    if (type === 'highlight') { updates.highlighted = true; updates.highlightedUntil = Date.now() + 86400000; }
    if (type === 'pin') { updates.pinned = true; updates.pinnedUntil = Date.now() + 86400000; }
    Object.assign(myOffer, updates);
    if (db) db.ref('offers/' + myOffer.id).update(updates);
    showToast('Продвижение применено!', 'success');
}

function checkDealLimit() {
    if (state.user?.isPro) return true;
    const today = new Date().toDateString();
    const myDeals = state.myDeals || [];
    const todayDeals = myDeals.filter(d => new Date(d.created_at * 1000).toDateString() === today).length;
    if (todayDeals >= 3) {
        showConfirm('Лимит сделок', 'Вы достигли лимита 3 сделки в день. Оформите PRO!', () => showSubscription());
        return false;
    }
    return true;
}

// ========== ADMIN PANEL ==========
const ADMIN_PASSWORD = '2323';
let adminPeriod = 'day';
let adminData = { users: [], deals: [], offers: [] };
let isAdminUnlocked = false;

function secretAdmin() {
    const pass = prompt('🔐');
    if (pass === ADMIN_PASSWORD) {
        isAdminUnlocked = true;
        document.getElementById('adminMenu').style.display = 'block';
        showToast('Админка активирована 👑', 'success');
    }
}

function checkAdmin() {
    const adminMenu = document.getElementById('adminMenu');
    if (adminMenu) {
        adminMenu.style.display = isAdminUnlocked ? 'block' : 'none';
    }
}

function showAdminPanel() {
    if (!isAdminUnlocked) {
        showToast('Доступ запрещён', 'error');
        return;
    }
    openModal('adminModal');
    loadAdminData();
}

function loadAdminData() {
    if (!db) {
        // Демо данные
        adminData = {
            users: [
                { id: '1', name: 'Александр', username: 'alex', last_active: Date.now(), deals: 5 },
                { id: '2', name: 'Мария', username: 'maria', last_active: Date.now() - 300000, deals: 3 },
                { id: '3', name: 'Иван', username: 'ivan', last_active: Date.now() - 3600000, deals: 8 }
            ],
            deals: [
                { id: '1', from: 'USD', to: 'KZT', amount: 1000, status: 'active', created_at: Date.now() / 1000 },
                { id: '2', from: 'EUR', to: 'KZT', amount: 500, status: 'completed', created_at: (Date.now() - 86400000) / 1000 }
            ],
            offers: state.allOffers || []
        };
        renderAdminPanel();
        return;
    }

    // Загрузка из Firebase
    Promise.all([
        db.ref('users').once('value'),
        db.ref('deals').once('value'),
        db.ref('offers').once('value')
    ]).then(([usersSnap, dealsSnap, offersSnap]) => {
        adminData.users = [];
        usersSnap.forEach(child => adminData.users.push({ id: child.key, ...child.val() }));

        adminData.deals = [];
        dealsSnap.forEach(child => adminData.deals.push({ id: child.key, ...child.val() }));

        adminData.offers = [];
        offersSnap.forEach(child => adminData.offers.push({ id: child.key, ...child.val() }));

        renderAdminPanel();
    });
}

function renderAdminPanel() {
    updateAdminStats();
    renderAdminChart();
    renderAdminUsers();
    renderAdminDeals();
    renderAdminNews();
}

function updateAdminStats() {
    const now = Date.now();
    const periodMs = adminPeriod === 'day' ? 86400000 : adminPeriod === 'week' ? 604800000 : 2592000000;
    const periodStart = now - periodMs;

    const periodDeals = adminData.deals.filter(d => d.created_at * 1000 > periodStart);
    const periodUsers = adminData.users.filter(u => u.last_active > periodStart);

    document.getElementById('adminTotalUsers').textContent = adminData.users.length;
    document.getElementById('adminTotalDeals').textContent = periodDeals.length;
    document.getElementById('adminTotalOffers').textContent = adminData.offers.length;

    const revenue = periodDeals.filter(d => d.status === 'completed').length * PRICES.serviceFee;
    document.getElementById('adminRevenue').textContent = revenue.toLocaleString() + ' ₸';
}

function setAdminPeriod(period) {
    adminPeriod = period;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderAdminPanel();
}

function renderAdminChart() {
    const chart = document.getElementById('adminChart');
    if (!chart) return;

    const now = Date.now();
    let labels = [];
    let data = [];

    if (adminPeriod === 'day') {
        // 24 часа
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(now - i * 3600000).getHours();
            labels.push(hour + ':00');
            const hourStart = now - (i + 1) * 3600000;
            const hourEnd = now - i * 3600000;
            data.push(adminData.deals.filter(d => d.created_at * 1000 > hourStart && d.created_at * 1000 <= hourEnd).length);
        }
        // Показываем только каждые 4 часа
        labels = labels.map((l, i) => i % 4 === 0 ? l : '');
    } else if (adminPeriod === 'week') {
        // 7 дней
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now - i * 86400000);
            labels.push(days[date.getDay()]);
            const dayStart = now - (i + 1) * 86400000;
            const dayEnd = now - i * 86400000;
            data.push(adminData.deals.filter(d => d.created_at * 1000 > dayStart && d.created_at * 1000 <= dayEnd).length);
        }
    } else {
        // 30 дней (по 5 дней)
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now - i * 5 * 86400000);
            labels.push(date.getDate() + '.' + (date.getMonth() + 1));
            const start = now - (i + 1) * 5 * 86400000;
            const end = now - i * 5 * 86400000;
            data.push(adminData.deals.filter(d => d.created_at * 1000 > start && d.created_at * 1000 <= end).length);
        }
    }

    const maxVal = Math.max(...data, 1);
    chart.innerHTML = data.map((val, i) => {
        const height = (val / maxVal) * 160 + 10;
        return `<div class="chart-bar" style="height: ${height}px" data-value="${val}" data-label="${labels[i]}"></div>`;
    }).join('');
}

function renderAdminUsers() {
    const container = document.getElementById('adminUsersList');
    if (!container) return;

    const now = Date.now();
    const sorted = [...adminData.users].sort((a, b) => (b.last_active || 0) - (a.last_active || 0)).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="admin-empty">Нет пользователей</div>';
        return;
    }

    container.innerHTML = sorted.map(user => {
        const isOnline = (now - (user.last_active || 0)) < 300000; // 5 мин
        const lastSeen = user.last_active ? formatTimeAgo(user.last_active) : 'неизвестно';

        return `
            <div class="admin-user-item">
                <div class="admin-user-avatar">${(user.name || 'U')[0].toUpperCase()}</div>
                <div class="admin-user-info">
                    <div class="admin-user-name">${escapeHtml(user.name || 'Пользователь')}</div>
                    <div class="admin-user-meta">@${user.username || 'unknown'} · ${user.deals || 0} сделок · ${lastSeen}</div>
                </div>
                <div class="admin-user-status ${isOnline ? '' : 'offline'}"></div>
            </div>
        `;
    }).join('');
}

function renderAdminDeals() {
    const container = document.getElementById('adminDealsList');
    if (!container) return;

    const sorted = [...adminData.deals].sort((a, b) => b.created_at - a.created_at).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="admin-empty">Нет сделок</div>';
        return;
    }

    const statusLabels = { active: 'Активна', completed: 'Завершена', cancelled: 'Отменена', pending: 'Ожидает' };

    container.innerHTML = sorted.map(deal => {
        const date = new Date(deal.created_at * 1000);
        const status = deal.status || 'active';

        return `
            <div class="admin-deal-item">
                <div class="admin-deal-info">
                    <div class="admin-deal-pair">${deal.from_currency || deal.from || '?'} → ${deal.to_currency || deal.to || '?'}</div>
                    <div class="admin-deal-meta">${deal.amount || 0} · ${date.toLocaleDateString('ru-RU')}</div>
                </div>
                <span class="admin-deal-status ${status}">${statusLabels[status] || status}</span>
            </div>
        `;
    }).join('');
}

function renderAdminNews() {
    const container = document.getElementById('adminNewsList');
    if (!container) return;

    if (newsData.length === 0) {
        container.innerHTML = '<div class="admin-empty">Нет новостей</div>';
        return;
    }

    container.innerHTML = newsData.map(news => `
        <div class="admin-news-item">
            <span class="admin-news-title">${news.pinned ? '📌 ' : ''}${escapeHtml(news.title)}</span>
            <button class="admin-news-delete" onclick="deleteNews('${news.id}')">Удалить</button>
        </div>
    `).join('');
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return Math.floor(diff / 86400000) + ' дн назад';
}

let newsImageData = null;

function showAddNewsForm() {
    openModal('addNewsModal');
    newsImageData = null;
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsText').value = '';
    document.getElementById('newsPinned').checked = false;
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('previewImage').style.display = 'none';
    updatePreview();
}

function updatePreview() {
    const title = document.getElementById('newsTitle').value || 'Заголовок';
    const text = document.getElementById('newsText').value || 'Текст новости...';
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewText').textContent = text;
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        newsImageData = e.target.result;
        document.getElementById('uploadedImagePreview').src = newsImageData;
        document.getElementById('imagePreviewContainer').style.display = 'block';
        document.getElementById('previewImage').src = newsImageData;
        document.getElementById('previewImage').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    newsImageData = null;
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('previewImage').style.display = 'none';
    document.getElementById('newsImageInput').value = '';
}

function publishNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const text = document.getElementById('newsText').value.trim();
    const pinned = document.getElementById('newsPinned').checked;

    if (!title || !text) {
        showToast('Заполни заголовок и текст', 'error');
        return;
    }

    const news = {
        title,
        text,
        pinned,
        image: newsImageData || null,
        created_at: Math.floor(Date.now() / 1000),
        views: 0
    };

    if (db) {
        db.ref('news').push(news).then(() => {
            showToast('Опубликовано! 🚀', 'success');
            closeModal('addNewsModal');
            newsImageData = null;
        });
    } else {
        newsData.unshift({ id: 'local_' + Date.now(), ...news });
        updateNewsBanner();
        renderAdminNews();
        showToast('Добавлено локально', 'success');
        closeModal('addNewsModal');
        newsImageData = null;
    }
}

function deleteNews(newsId) {
    showConfirm('Удалить новость?', 'Это действие нельзя отменить', () => {
        if (db) {
            db.ref('news/' + newsId).remove().then(() => {
                showToast('Новость удалена', 'success');
            });
        } else {
            newsData = newsData.filter(n => n.id !== newsId);
            renderNews();
            renderAdminNews();
            showToast('Новость удалена', 'success');
        }
    });
}

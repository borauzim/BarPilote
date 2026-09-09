const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const template = fs.readFileSync('proprietaire/templates/proprietaire/dashboard.html', 'utf8');
const script = template.slice(template.indexOf('        function applyOwnerOrderStatus('), template.indexOf('        function toggleInlineOrderDetails('));

function harness(initialOrders = []) {
    const container = {innerHTML: ''};
    const listeners = {};
    let orders = structuredClone(initialOrders);
    const context = {
        URLSearchParams, Set, Date, console,
        document: {getElementById: id => id === 'liveOrdersContainer' ? container : null, querySelector: () => null},
        window: {addEventListener: (name, fn) => {listeners[name] = fn;}, removeEventListener: () => {}},
        history: {replaceState() {}},
        alert: message => {context.lastError = message;},
        getCookie: () => 'csrf',
        formatDuration: () => '00:01',
        cashConfirmationBadgeFromStart: () => 'Cash demandé',
        fetch: async (url, options) => {
            if (!options) return {json: async () => ({orders})};
            const body = new URLSearchParams(options.body);
            const ids = body.get('order_id').split(',');
            const status = body.get('status');
            orders = orders.map(order => ids.includes(order.id) ? {...order, statut: status} : order)
                .filter(order => !['PAID', 'CANCELLED'].includes(order.statut));
            return {ok: true, json: async () => ({success: true, new_status: status})};
        },
    };
    vm.createContext(context);
    vm.runInContext('let ownerLiveOrders = [];\n' + script, context);
    context.renderLiveOrders(initialOrders);
    return {context, container, listeners};
}

function order(id, statut) {
    return {id, statut, table_nom: 'Table 1', total_usd: 10, total_cdf: 0, timestamp: Date.now()/1000,
        date_creation: new Date().toISOString(), items: [{id: 'beer', name: 'Bière', qty: 1, price: 10}]};
}

test('each stage remains actionable at the same table', () => {
    const {container} = harness([order('pending', 'PENDING'), order('accepted', 'ACCEPTEE'), order('preparing', 'PREPARING'), order('served', 'SERVED')]);
    for (const label of ['Accepter', 'Refuser', 'Préparer', 'Servir', 'Encaisser le cash', 'Accepter une dette']) {
        assert.ok(container.innerHTML.includes(label), label);
    }
    assert.ok(container.innerHTML.includes("updateOrderStatus('accepted', 'PREPARING')"));
    assert.ok(container.innerHTML.includes("openPaymentModal('served'"));
    assert.ok(!container.innerHTML.includes("openPaymentModal('pending"));
});

test('cash request still offers debt', () => {
    const served = {...order('served', 'SERVED'), payment_requested: true, payment_requested_at: new Date().toISOString()};
    const {container} = harness([served]);
    assert.ok(container.innerHTML.includes('Confirmer le cash'));
    assert.ok(container.innerHTML.includes('Accepter une dette'));
});

test('global alert acceptance refreshes journal without websocket', async () => {
    const {context, container, listeners} = harness([order('one', 'ACCEPTEE')]);
    listeners['barpilote:owner-order-action']({detail: {order_id: 'one', status: 'ACCEPTEE'}});
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(container.innerHTML.includes('Préparer'));
    assert.ok(!container.innerHTML.includes('>Accepter</button>'));
    await context.updateOrderStatus('one', 'PREPARING');
    assert.ok(container.innerHTML.includes('>Servir</button>'));
    await context.updateOrderStatus('one', 'SERVED');
    assert.ok(container.innerHTML.includes('Encaisser le cash'));
    await context.updateOrderStatus('one', 'PAID');
    assert.ok(container.innerHTML.includes('Aucune activité'));
});

test('failed action surfaces error and restores server state', async () => {
    const {context, container} = harness([order('one', 'ACCEPTEE')]);
    const originalFetch = context.fetch;
    context.fetch = async (url, options) => options ? {ok: false, json: async () => ({error: 'Commande déjà modifiée'})} : originalFetch(url);
    await context.updateOrderStatus('one', 'PREPARING');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.lastError, 'Commande déjà modifiée');
    assert.ok(container.innerHTML.includes('Préparer'));
});

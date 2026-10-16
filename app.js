import { PRINTER_PROFILES, FILAMENT_PROFILES, MARKETPLACE_CONFIG } from './presets.js';
import { PricingEngine } from './calculator.js';
import { GCodeParser } from './gcodeParser.js';

// Inicialização da engine
const engine = new PricingEngine();

// Estado da aplicação
const state = {
  marketplaceKey: 'ml_premium',
  calcMode: 'price', // 'price' ou 'margin'
  productName: 'Suporte Articulado Gamer',
  salePrice: 74.90,
  targetMargin: 50.0,
  weightGrams: 85,
  filamentType: 'pla',
  filamentPriceKg: 80.00,
  lossMarginPercent: 0,
  printHours: 2,
  printMinutes: 30,
  printerId: 'bambu-p1s',
  printerWatts: 120,
  costPerKwh: 0.85,
  packagingCost: 2.38,
  machineHourCost: 0.00,
  extraInsumosCost: 0.00,
  taxPercent: 6.0,
  isCpfShopee: false,
  paymentMethodDirect: 'pix',
  cardFeePercentDirect: 3.5,
  dailyWorkingHours: 20,
  promoDiscountPercent: 10.0,
  customShipping: null,

  // Modo Lote / Atacado
  quantity: 1,
  batchDiscountPercent: 0,
  batchPackagingType: 'single'
};

// Histórico de cálculos salvos no localStorage
let savedCalculations = [];
try {
  const localHistory = localStorage.getItem('precificadora3d_history');
  if (localHistory) savedCalculations = JSON.parse(localHistory);
} catch (e) {
  console.warn('Erro ao carregar histórico:', e);
}

// Elementos DOM
const elements = {
  // Tabs & Mode
  mpTabs: document.querySelectorAll('.mp-tab'),
  mlSubOptions: document.getElementById('ml-sub-options'),
  shopeeSubOptions: document.getElementById('shopee-sub-options'),
  diretaSubOptions: document.getElementById('direta-sub-options'),
  modePriceBtn: document.getElementById('mode-price-btn'),
  modeMarginBtn: document.getElementById('mode-margin-btn'),
  priceInputGroup: document.getElementById('price-input-group'),
  marginInputGroup: document.getElementById('margin-input-group'),

  // Inputs
  productNameInput: document.getElementById('product-name-input'),
  salePriceInput: document.getElementById('sale-price-input'),
  targetMarginInput: document.getElementById('target-margin-input'),
  weightInput: document.getElementById('weight-input'),
  filamentSelect: document.getElementById('filament-select'),
  filamentPriceInput: document.getElementById('filament-price-input'),
  hoursInput: document.getElementById('hours-input'),
  minutesInput: document.getElementById('minutes-input'),
  printerSelect: document.getElementById('printer-select'),
  printerWattsInput: document.getElementById('printer-watts-input'),
  wattsRow: document.getElementById('watts-row'),
  kwhCostInput: document.getElementById('kwh-cost-input'),
  packagingInput: document.getElementById('packaging-input'),
  insumosInput: document.getElementById('insumos-input'),
  machineCostInput: document.getElementById('machine-cost-input'),
  taxPercentInput: document.getElementById('tax-percent-input'),
  dailyHoursInput: document.getElementById('daily-hours-input'),
  promoDiscountInput: document.getElementById('promo-discount-input'),
  shopeeCpfCheckbox: document.getElementById('shopee-cpf-checkbox'),

  // G-Code Dropzone
  gcodeDropzone: document.getElementById('gcode-dropzone'),
  gcodeFileInput: document.getElementById('gcode-file-input'),
  btnBrowseGcode: document.getElementById('btn-browse-gcode'),
  dropzoneStatus: document.getElementById('dropzone-status'),
  dropzoneStatusIcon: document.getElementById('dropzone-status-icon'),
  dropzoneStatusText: document.getElementById('dropzone-status-text'),
  dropzoneTip: document.getElementById('dropzone-tip'),

  // Modo Lote / Atacado
  batchQtyInput: document.getElementById('batch-qty-input'),
  batchDiscountInput: document.getElementById('batch-discount-input'),
  batchPills: document.querySelectorAll('.batch-pill'),
  batchActiveBadge: document.getElementById('batch-active-badge'),
  batchResultCard: document.getElementById('batch-result-card'),
  batchDispQty: document.getElementById('batch-disp-qty'),
  batchTotalProfit: document.getElementById('batch-total-profit'),
  batchTotalMargin: document.getElementById('batch-total-margin'),
  batchUnitProfit: document.getElementById('batch-unit-profit'),
  batchTotalRevenue: document.getElementById('batch-total-revenue'),
  batchTotalTime: document.getElementById('batch-total-time'),
  batchTotalFilament: document.getElementById('batch-total-filament'),

  // Displays de Resultado Unitário
  netProfitBig: document.getElementById('net-profit-big'),
  netMarginBig: document.getElementById('net-margin-big'),
  marginBadge: document.getElementById('margin-badge'),
  profitPerHourDisp: document.getElementById('profit-per-hour'),
  dailyPotentialDisp: document.getElementById('daily-potential'),

  // SVG Donut Chart
  donutSvg: document.getElementById('donut-svg'),
  donutCenterVal: document.getElementById('donut-center-val'),
  donutCenterLbl: document.getElementById('donut-center-lbl'),
  donutLegend: document.getElementById('donut-legend'),
  cascadeContainer: document.getElementById('cascade-container'),

  // Cascata
  cascadeBasePrice: document.getElementById('cascade-base-price'),
  cascadeMpLabel: document.getElementById('cascade-mp-label'),
  cascadeMpValue: document.getElementById('cascade-mp-value'),
  cascadeShippingBox: document.getElementById('cascade-shipping-box'),
  cascadeShippingLabel: document.getElementById('cascade-shipping-label'),
  cascadeShippingValue: document.getElementById('cascade-shipping-value'),
  cascadeTaxLabel: document.getElementById('cascade-tax-label'),
  cascadeTaxValue: document.getElementById('cascade-tax-value'),
  cascadeElectricityLabel: document.getElementById('cascade-electricity-label'),
  cascadeElectricityValue: document.getElementById('cascade-electricity-value'),
  cascadeFilamentLabel: document.getElementById('cascade-filament-label'),
  cascadeFilamentValue: document.getElementById('cascade-filament-value'),
  cascadePackagingLabel: document.getElementById('cascade-packaging-label'),
  cascadePackagingValue: document.getElementById('cascade-packaging-value'),
  cascadeNetProfit: document.getElementById('cascade-net-profit'),

  // Promo Card
  promoAnnouncedPrice: document.getElementById('promo-announced-price'),
  promoCustomerPays: document.getElementById('promo-customer-pays'),
  promoTagline: document.getElementById('promo-tagline'),

  // Capacidade
  capProfitHour: document.getElementById('cap-profit-hour'),
  capPiecesDay: document.getElementById('cap-pieces-day'),
  capMonthlyProfit: document.getElementById('cap-monthly-profit'),

  // Matrix
  matrixBody: document.getElementById('matrix-body'),

  // Mobile Sticky Bar
  mobileStickyBar: document.getElementById('mobile-sticky-bar'),
  mobileChannelTag: document.getElementById('mobile-channel-tag'),
  mobileProfitVal: document.getElementById('mobile-profit-val'),
  mobileMarginBadge: document.getElementById('mobile-margin-badge'),
  mobileBtnDetails: document.getElementById('mobile-btn-details'),
  mobileBtnSave: document.getElementById('mobile-btn-save'),

  // Modals & Buttons
  saveCalcBtn: document.getElementById('btn-save-calc'),
  copySummaryBtn: document.getElementById('btn-copy-summary'),
  historyBtn: document.getElementById('btn-history'),
  historyModal: document.getElementById('history-modal'),
  closeHistoryBtn: document.getElementById('close-history-modal'),
  historyList: document.getElementById('history-list'),

  prefsBtn: document.getElementById('btn-prefs'),
  prefsModal: document.getElementById('prefs-modal'),
  closePrefsBtn: document.getElementById('close-prefs-modal'),
  savePrefsBtn: document.getElementById('save-prefs-btn'),
  prefPrinterSelect: document.getElementById('pref-printer-select'),
  prefKwhInput: document.getElementById('pref-kwh-input'),
  prefTaxInput: document.getElementById('pref-tax-input'),
  prefPackagingInput: document.getElementById('pref-packaging-input'),

  toastContainer: document.getElementById('toast-container')
};

// Popula os selects com os perfis
function initializeSelectors() {
  // Impressoras
  elements.printerSelect.innerHTML = PRINTER_PROFILES.map(p => 
    `<option value="${p.id}">${p.name} (${p.watts}W)</option>`
  ).join('');

  elements.prefPrinterSelect.innerHTML = elements.printerSelect.innerHTML;

  // Filamentos
  elements.filamentSelect.innerHTML = FILAMENT_PROFILES.map(f => 
    `<option value="${f.id}">${f.name}</option>`
  ).join('');

  // Aplica preferências salvas
  const prefs = engine.preferences;
  if (prefs.defaultPrinterId) {
    state.printerId = prefs.defaultPrinterId;
    elements.printerSelect.value = prefs.defaultPrinterId;
    elements.prefPrinterSelect.value = prefs.defaultPrinterId;
    const p = PRINTER_PROFILES.find(x => x.id === prefs.defaultPrinterId);
    if (p) state.printerWatts = p.watts;
  }
  if (prefs.defaultKwhCost) {
    state.costPerKwh = prefs.defaultKwhCost;
    elements.kwhCostInput.value = prefs.defaultKwhCost;
    elements.prefKwhInput.value = prefs.defaultKwhCost;
  }
  if (prefs.defaultTaxPercent) {
    state.taxPercent = prefs.defaultTaxPercent;
    elements.taxPercentInput.value = prefs.defaultTaxPercent;
    elements.prefTaxInput.value = prefs.defaultTaxPercent;
  }
  if (prefs.defaultPackagingCost) {
    state.packagingCost = prefs.defaultPackagingCost;
    elements.packagingInput.value = prefs.defaultPackagingCost;
    elements.prefPackagingInput.value = prefs.defaultPackagingCost;
  }
}

// Mostra Toast Notification
function showToast(message, icon = '✓') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Lê todos os inputs do formulário para o estado
function syncStateFromInputs() {
  state.productName = elements.productNameInput.value.trim() || 'Peça Impressa 3D';
  state.weightGrams = parseFloat(elements.weightInput.value) || 0;
  state.filamentPriceKg = parseFloat(elements.filamentPriceInput.value) || 0;
  state.printHours = parseInt(elements.hoursInput.value) || 0;
  state.printMinutes = parseInt(elements.minutesInput.value) || 0;
  state.costPerKwh = parseFloat(elements.kwhCostInput.value) || 0;
  state.packagingCost = parseFloat(elements.packagingInput.value) || 0;
  state.extraInsumosCost = parseFloat(elements.insumosInput.value) || 0;
  state.machineHourCost = parseFloat(elements.machineCostInput.value) || 0;
  state.taxPercent = parseFloat(elements.taxPercentInput.value) || 0;
  state.dailyWorkingHours = parseFloat(elements.dailyHoursInput.value) || 20;
  state.promoDiscountPercent = parseFloat(elements.promoDiscountInput.value) || 0;
  state.isCpfShopee = elements.shopeeCpfCheckbox.checked;

  // Lote
  state.quantity = parseInt(elements.batchQtyInput?.value, 10) || 1;
  state.batchDiscountPercent = parseFloat(elements.batchDiscountInput?.value) || 0;
  const batchPackRadio = document.querySelector('input[name="batch-pack-tier"]:checked');
  state.batchPackagingType = batchPackRadio ? batchPackRadio.value : 'single';

  if (state.printerId === 'custom') {
    state.printerWatts = parseFloat(elements.printerWattsInput.value) || 100;
  }

  if (state.calcMode === 'price') {
    state.salePrice = parseFloat(elements.salePriceInput.value) || 0;
  } else {
    state.targetMargin = parseFloat(elements.targetMarginInput.value) || 0;
  }
}

// Renderiza o gráfico Donut Chart interativo
function renderDonutChart(result, effectivePrice) {
  if (!elements.donutSvg) return;

  const rawProfit = result.netProfit;
  const isLoss = rawProfit < 0;

  // Segmentos de custo
  const segments = [
    { id: 'profit', name: isLoss ? 'Prejuízo' : 'Lucro Líquido', val: isLoss ? Math.abs(rawProfit) : rawProfit, color: isLoss ? '#ff3f5e' : '#00e5a0' },
    { id: 'marketplace', name: 'Marketplace', val: result.marketplaceFee, color: '#f59e0b' },
    { id: 'shipping', name: 'Frete / Fixo', val: result.shippingCost, color: '#818cf8' },
    { id: 'taxes', name: 'Impostos', val: result.taxesCost, color: '#f43f5e' },
    { id: 'filament', name: 'Filamento', val: result.filamentCost, color: '#ec4899' },
    { id: 'electricity', name: 'Energia', val: result.electricityCost, color: '#38bdf8' },
    { id: 'packaging', name: 'Embalagem & Outros', val: result.packagingCost + result.insumosCost + result.depreciationCost, color: '#c084fc' }
  ].filter(s => s.val > 0.005);

  const totalVal = segments.reduce((sum, s) => sum + s.val, 0) || 1;

  // Adiciona porcentagens
  segments.forEach(s => {
    s.pct = (s.val / totalVal) * 100;
  });

  const cx = 100, cy = 100, R = 80, r = 52;
  let accumAngle = 0;

  const pathsHtml = segments.map((seg) => {
    const sliceAngle = (seg.val / totalVal) * 360;
    const a0 = accumAngle;
    const a1 = accumAngle + sliceAngle;
    accumAngle += sliceAngle;

    if (sliceAngle >= 359.9) {
      return `
        <circle class="donut-slice" cx="${cx}" cy="${cy}" r="${(R + r) / 2}" 
          fill="none" stroke="${seg.color}" stroke-width="${R - r}" 
          data-seg-id="${seg.id}" data-seg-val="${seg.val}" data-seg-name="${seg.name}" data-seg-pct="${seg.pct.toFixed(1)}">
        </circle>
      `;
    }

    const rad0 = (a0 - 90) * (Math.PI / 180);
    const rad1 = (a1 - 90) * (Math.PI / 180);

    const ox1 = cx + R * Math.cos(rad0);
    const oy1 = cy + R * Math.sin(rad0);
    const ox2 = cx + R * Math.cos(rad1);
    const oy2 = cy + R * Math.sin(rad1);

    const ix1 = cx + r * Math.cos(rad0);
    const iy1 = cy + r * Math.sin(rad0);
    const ix2 = cx + r * Math.cos(rad1);
    const iy2 = cy + r * Math.sin(rad1);

    const largeArc = sliceAngle > 180 ? 1 : 0;
    const d = `M ${ox1} ${oy1} A ${R} ${R} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${r} ${r} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

    return `
      <path class="donut-slice" d="${d}" fill="${seg.color}" 
        stroke="var(--bg-card-sub)" stroke-width="2"
        data-seg-id="${seg.id}" data-seg-val="${seg.val}" data-seg-name="${seg.name}" data-seg-pct="${seg.pct.toFixed(1)}">
      </path>
    `;
  }).join('');

  elements.donutSvg.innerHTML = pathsHtml;

  // Reseta o centro para o valor da margem
  const resetCenter = () => {
    if (elements.donutCenterVal) {
      elements.donutCenterVal.textContent = engine.formatPercent(result.netMarginPercent);
      elements.donutCenterVal.style.color = isLoss ? 'var(--accent-red)' : 'var(--accent-green)';
    }
    if (elements.donutCenterLbl) {
      elements.donutCenterLbl.textContent = isLoss ? 'Prejuízo' : 'Lucro Real';
    }
    document.querySelectorAll('.donut-legend-item').forEach(el => el.classList.remove('highlighted'));
  };

  resetCenter();

  // Renderiza a legenda
  elements.donutLegend.innerHTML = segments.map(seg => `
    <div class="donut-legend-item" data-legend-id="${seg.id}">
      <span class="donut-legend-dot" style="background: ${seg.color}"></span>
      <span>${seg.name} (${seg.pct.toFixed(1)}%)</span>
    </div>
  `).join('');

  // Event listeners para hover nas fatias
  elements.donutSvg.querySelectorAll('.donut-slice').forEach(slice => {
    slice.addEventListener('mouseenter', () => {
      const name = slice.getAttribute('data-seg-name');
      const val = parseFloat(slice.getAttribute('data-seg-val'));
      const pct = slice.getAttribute('data-seg-pct');
      const id = slice.getAttribute('data-seg-id');

      if (elements.donutCenterVal) {
        elements.donutCenterVal.textContent = engine.formatCurrency(val);
        elements.donutCenterVal.style.color = slice.getAttribute('fill') || 'var(--text-main)';
      }
      if (elements.donutCenterLbl) {
        elements.donutCenterLbl.textContent = `${name} (${pct}%)`;
      }

      document.querySelectorAll('.donut-legend-item').forEach(leg => {
        if (leg.getAttribute('data-legend-id') === id) leg.classList.add('highlighted');
        else leg.classList.remove('highlighted');
      });
    });

    slice.addEventListener('mouseleave', resetCenter);
  });

  // Event listeners para hover na legenda
  elements.donutLegend.querySelectorAll('.donut-legend-item').forEach(leg => {
    leg.addEventListener('mouseenter', () => {
      const id = leg.getAttribute('data-legend-id');
      const targetSlice = elements.donutSvg.querySelector(`[data-seg-id="${id}"]`);
      if (targetSlice) {
        const event = new MouseEvent('mouseenter');
        targetSlice.dispatchEvent(event);
      }
    });

    leg.addEventListener('mouseleave', resetCenter);
  });
}

// Renderiza os cálculos e atualiza a interface
function updateCalculations() {
  syncStateFromInputs();

  let effectivePrice = state.salePrice;

  if (state.calcMode === 'margin') {
    effectivePrice = engine.findPriceForTargetMargin(state.targetMargin, state);
    state.salePrice = effectivePrice;
    elements.salePriceInput.value = effectivePrice.toFixed(2);
  }

  // 1. Cálculo Unitário Detalhado
  const result = engine.computeCostsForPrice(effectivePrice, state);

  // Atualiza Card Principal de Lucro Líquido
  elements.netProfitBig.textContent = engine.formatCurrency(result.netProfit);
  elements.netMarginBig.textContent = engine.formatPercent(result.netMarginPercent);

  const marginClass = engine.getMarginClassification(result.netMarginPercent);
  elements.marginBadge.textContent = marginClass.label;
  elements.marginBadge.style.color = marginClass.color;
  elements.marginBadge.style.backgroundColor = marginClass.bg;

  if (result.netProfit < 0) {
    elements.netProfitBig.style.color = 'var(--accent-red)';
    elements.netMarginBig.style.color = 'var(--accent-red)';
  } else {
    elements.netProfitBig.style.color = 'var(--accent-green)';
    elements.netMarginBig.style.color = 'var(--accent-green)';
  }

  const profitPerHour = result.netProfit / result.totalHours;
  const dailyPotential = profitPerHour * state.dailyWorkingHours;

  elements.profitPerHourDisp.textContent = `${engine.formatCurrency(profitPerHour)}/hora`;
  elements.dailyPotentialDisp.textContent = `${engine.formatCurrency(dailyPotential)}/dia (${state.dailyWorkingHours}h)`;

  // 2. Modo Lote / Atacado
  if (state.quantity > 1) {
    const batch = engine.computeBatchMetrics(
      effectivePrice, 
      state.quantity, 
      state, 
      state.batchPackagingType, 
      state.batchDiscountPercent
    );

    if (elements.batchActiveBadge) elements.batchActiveBadge.style.display = 'inline-block';
    if (elements.batchResultCard) {
      elements.batchResultCard.style.display = 'block';
      elements.batchDispQty.textContent = batch.quantity;
      elements.batchTotalProfit.textContent = engine.formatCurrency(batch.batchNetProfit);
      elements.batchTotalMargin.textContent = engine.formatPercent(batch.batchNetMarginPercent);
      elements.batchUnitProfit.textContent = engine.formatCurrency(batch.unitNetProfit);
      elements.batchTotalRevenue.textContent = engine.formatCurrency(batch.totalBatchPrice);
      elements.batchTotalTime.textContent = `${batch.totalBatchHours}h (${batch.totalPrintDays} dias)`;
      elements.batchTotalFilament.textContent = `${batch.totalFilamentKg} kg (${batch.spoolsEstimated} ${batch.spoolsEstimated === 1 ? 'carretel' : 'carretéis'})`;

      if (batch.batchNetProfit < 0) {
        elements.batchTotalProfit.style.color = 'var(--accent-red)';
      } else {
        elements.batchTotalProfit.style.color = 'var(--accent-green)';
      }
    }
  } else {
    if (elements.batchActiveBadge) elements.batchActiveBadge.style.display = 'none';
    if (elements.batchResultCard) elements.batchResultCard.style.display = 'none';
  }

  // 3. Atualiza Gráfico Donut SVG
  renderDonutChart(result, effectivePrice);

  // 4. Atualiza a Cascata Linha por Linha
  elements.cascadeBasePrice.textContent = engine.formatCurrency(effectivePrice);
  elements.cascadeMpLabel.textContent = `└─ ${result.marketplaceDetailName}`;
  elements.cascadeMpValue.textContent = `− ${engine.formatCurrency(result.marketplaceFee)}`;

  if (result.shippingCost > 0) {
    elements.cascadeShippingBox.style.display = 'flex';
    const isUnderThreshold = state.marketplaceKey.startsWith('ml') && effectivePrice < 79;
    elements.cascadeShippingLabel.textContent = isUnderThreshold 
      ? '└─ Custo Fixo ML (< R$ 79)' 
      : `└─ Frete estimado (${state.weightGrams}g)`;
    elements.cascadeShippingValue.textContent = `− ${engine.formatCurrency(result.shippingCost)}`;
  } else {
    elements.cascadeShippingBox.style.display = 'none';
  }

  elements.cascadeTaxLabel.textContent = `└─ Imposto (${state.taxPercent}%)`;
  elements.cascadeTaxValue.textContent = `− ${engine.formatCurrency(result.taxesCost)}`;

  elements.cascadeElectricityLabel.textContent = `└─ Energia elétrica (${(result.totalHours).toFixed(1)}h · ${state.printerWatts}W)`;
  elements.cascadeElectricityValue.textContent = `− ${engine.formatCurrency(result.electricityCost)}`;

  elements.cascadeFilamentLabel.textContent = `└─ Filamento (${state.weightGrams}g · R$${state.filamentPriceKg}/kg)`;
  elements.cascadeFilamentValue.textContent = `− ${engine.formatCurrency(result.filamentCost)}`;

  const totalPackagingAndInsumos = result.packagingCost + result.insumosCost + result.depreciationCost;
  elements.cascadePackagingLabel.textContent = `└─ Embalagem & Outros`;
  elements.cascadePackagingValue.textContent = `− ${engine.formatCurrency(totalPackagingAndInsumos)}`;

  elements.cascadeNetProfit.textContent = engine.formatCurrency(result.netProfit);

  // 5. Atualiza Promoção com Lucro Preservado
  const promo = engine.calculatePromotion(effectivePrice, state.promoDiscountPercent);
  elements.promoAnnouncedPrice.textContent = engine.formatCurrency(promo.announcedPrice);
  elements.promoCustomerPays.textContent = engine.formatCurrency(promo.customerPays);
  elements.promoTagline.textContent = `💜 ${promo.discountPercent}% de desconto na campanha · Lucro de ${engine.formatCurrency(result.netProfit)} 100% intacto`;

  // 6. Capacidade Produtiva Real
  const capacity = engine.calculateProductionCapacity(result.netProfit, effectivePrice, result.totalHours, state.dailyWorkingHours);
  elements.capProfitHour.textContent = engine.formatCurrency(capacity.profitPerHour);
  elements.capPiecesDay.textContent = `${capacity.piecesPerDay} peças`;
  elements.capMonthlyProfit.textContent = engine.formatCurrency(capacity.monthlyProfit);

  // 7. Comparativo Multicanal Simultâneo
  renderMultiChannelMatrix(effectivePrice);

  // 8. Barra Flutuante Mobile
  if (elements.mobileStickyBar) {
    const mp = MARKETPLACE_CONFIG[state.marketplaceKey];
    if (elements.mobileChannelTag) elements.mobileChannelTag.textContent = mp ? (mp.subTag || mp.tag) : 'Ativo';
    
    if (state.quantity > 1) {
      const batch = engine.computeBatchMetrics(effectivePrice, state.quantity, state, state.batchPackagingType, state.batchDiscountPercent);
      if (elements.mobileProfitVal) elements.mobileProfitVal.textContent = engine.formatCurrency(batch.batchNetProfit);
      if (elements.mobileMarginBadge) elements.mobileMarginBadge.textContent = engine.formatPercent(batch.batchNetMarginPercent);
    } else {
      if (elements.mobileProfitVal) elements.mobileProfitVal.textContent = engine.formatCurrency(result.netProfit);
      if (elements.mobileMarginBadge) elements.mobileMarginBadge.textContent = engine.formatPercent(result.netMarginPercent);
    }

    if (elements.mobileProfitVal) {
      elements.mobileProfitVal.style.color = result.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }
  }
}

// Renderiza a matriz comparativa de marketplaces
function renderMultiChannelMatrix(currentPrice) {
  const channels = [
    { key: 'ml_premium', name: 'Mercado Livre Premium', icon: '🟡' },
    { key: 'ml_classico', name: 'Mercado Livre Clássico', icon: '🟡' },
    { key: 'shopee_fge', name: 'Shopee (FGE 2026)', icon: '🟠' },
    { key: 'shopee_padrao', name: 'Shopee Padrão', icon: '🟠' },
    { key: 'venda_direta', name: 'Venda Direta (Pix)', icon: '🟢' }
  ];

  elements.matrixBody.innerHTML = channels.map(ch => {
    const calcCopy = { ...state, marketplaceKey: ch.key };
    const r = engine.computeCostsForPrice(currentPrice, calcCopy);
    const m = engine.getMarginClassification(r.netMarginPercent);
    const isCurrent = state.marketplaceKey === ch.key;

    return `
      <tr style="${isCurrent ? 'background: rgba(0,229,160,0.06); font-weight: bold;' : ''}">
        <td>
          <span class="channel-name">
            <span>${ch.icon}</span> ${ch.name}
            ${isCurrent ? '<span style="color:var(--accent-green); font-size:10px; margin-left:6px;">(Ativo)</span>' : ''}
          </span>
        </td>
        <td class="mono">${engine.formatCurrency(r.price)}</td>
        <td class="mono" style="color: var(--accent-red)">− ${engine.formatCurrency(r.marketplaceFee + r.shippingCost)}</td>
        <td class="mono" style="color: ${r.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${engine.formatCurrency(r.netProfit)}</td>
        <td>
          <span style="color: ${m.color}; font-weight: 700;" class="mono">${engine.formatPercent(r.netMarginPercent)}</span>
        </td>
        <td>
          <button class="btn-ghost" style="padding: 4px 8px; font-size: 11px;" data-select-channel="${ch.key}">
            Simular
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Event listener para botão Simular da matriz
  document.querySelectorAll('[data-select-channel]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetChannel = e.currentTarget.getAttribute('data-select-channel');
      setMarketplace(targetChannel);
    });
  });
}

// Altera o marketplace ativo
function setMarketplace(key) {
  state.marketplaceKey = key;

  // Atualiza botões das tabs
  elements.mpTabs.forEach(tab => {
    if (tab.getAttribute('data-mp') === key) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Mostra/Oculta sub-opções
  if (key === 'ml_premium' || key === 'ml_classico') {
    elements.mlSubOptions.style.display = 'flex';
    elements.shopeeSubOptions.style.display = 'none';
    elements.diretaSubOptions.style.display = 'none';
    const radio = document.querySelector(`input[name="ml-tier"][value="${key}"]`);
    if (radio) radio.checked = true;
  } else if (key === 'shopee_fge' || key === 'shopee_padrao') {
    elements.mlSubOptions.style.display = 'none';
    elements.shopeeSubOptions.style.display = 'flex';
    elements.diretaSubOptions.style.display = 'none';
    const radio = document.querySelector(`input[name="shopee-tier"][value="${key}"]`);
    if (radio) radio.checked = true;
  } else if (key === 'venda_direta') {
    elements.mlSubOptions.style.display = 'none';
    elements.shopeeSubOptions.style.display = 'none';
    elements.diretaSubOptions.style.display = 'flex';
  }

  updateCalculations();
}

// Manipulação do Arquivo G-Code / 3MF
async function handleGCodeFile(file) {
  try {
    showToast(`Analisando "${file.name}"...`, '⏳');
    const meta = await GCodeParser.parseFile(file);

    if (meta.success) {
      if (meta.cleanName && meta.cleanName !== 'Peça Impressa 3D') {
        elements.productNameInput.value = meta.cleanName;
        state.productName = meta.cleanName;
      }
      if (meta.hours > 0 || meta.minutes > 0) {
        elements.hoursInput.value = meta.hours;
        elements.minutesInput.value = meta.minutes;
        state.printHours = meta.hours;
        state.printMinutes = meta.minutes;
      }
      if (meta.weightGrams > 0) {
        elements.weightInput.value = meta.weightGrams;
        state.weightGrams = meta.weightGrams;
      }
      if (meta.filamentType) {
        elements.filamentSelect.value = meta.filamentType;
        const prof = FILAMENT_PROFILES.find(f => f.id === meta.filamentType);
        if (prof) {
          elements.filamentPriceInput.value = prof.defaultPrice.toFixed(2);
          state.filamentPriceKg = prof.defaultPrice;
        }
        state.filamentType = meta.filamentType;
      }

      // Auto-seleciona impressora se detectada no arquivo de projeto
      if (meta.printerModel) {
        const lower = meta.printerModel.toLowerCase();
        let matchId = null;
        if (lower.includes('a1 mini')) matchId = 'bambu_a1_mini';
        else if (lower.includes('a1')) matchId = 'bambu_a1';
        else if (lower.includes('p1p')) matchId = 'bambu_p1p';
        else if (lower.includes('p1s')) matchId = 'bambu_p1s';
        else if (lower.includes('x1')) matchId = 'bambu_x1c';
        else if (lower.includes('k1')) matchId = 'creality_k1';
        else if (lower.includes('ender')) matchId = 'ender3';
        if (matchId && elements.printerSelect) {
          elements.printerSelect.value = matchId;
          const prof = PRINTER_PROFILES.find(p => p.id === matchId);
          if (prof) {
            state.printerId = matchId;
            state.printerWatts = prof.watts;
            elements.printerWattsInput.value = prof.watts;
          }
        }
      }

      if (elements.dropzoneStatus) {
        elements.dropzoneStatus.style.display = 'flex';
        if (meta.isModelOnly) {
          if (elements.dropzoneStatusIcon) elements.dropzoneStatusIcon.textContent = '💡';
          elements.dropzoneStatusText.textContent = `Projeto 3D: "${meta.cleanName}" (${meta.dimensions || ''}) · Estimativa: ~${meta.weightGrams}g · ~${meta.rawTimeStr}`;
          elements.dropzoneStatus.style.borderColor = 'rgba(56, 189, 248, 0.4)';
          elements.dropzoneStatus.style.background = 'rgba(56, 189, 248, 0.12)';
          elements.dropzoneStatus.style.color = 'var(--accent-blue)';

          if (elements.dropzoneTip) {
            elements.dropzoneTip.style.display = 'block';
            elements.dropzoneTip.innerHTML = `
              <strong>ℹ️ Projeto 3D (.3MF) Detectado:</strong> Este arquivo contém o modelo 3D e configurações, mas não contém as trilhas de G-code finais fatiadas. Por isso, os valores acima foram preenchidos com uma <strong>estimativa calculada do volume 3D (~${meta.weightGrams}g e ~${meta.rawTimeStr})</strong>.<br><br>
              ⚡ <strong>Para obter tempo e peso 100% exatos do Bambu Studio:</strong><br>
              No Bambu Studio, clique na <strong>setinha ▾ ao lado do botão verde "Imprimir"</strong> e escolha <strong>"Exportar arquivo fatiado de mesa"</strong> (gera um arquivo <code>.gcode.3mf</code> ou <code>.gcode</code>) e solte aqui! Ou, se preferir, ajuste o tempo e peso manualmente nas caixas abaixo.
            `;
          }
        } else {
          if (elements.dropzoneStatusIcon) elements.dropzoneStatusIcon.textContent = '✓';
          elements.dropzoneStatusText.textContent = `${meta.slicer}: ${meta.rawTimeStr || (meta.hours + 'h ' + meta.minutes + 'm')} · ${meta.weightGrams}g ${meta.filamentType ? '· ' + meta.filamentType.toUpperCase() : ''}`;
          elements.dropzoneStatus.style.borderColor = 'var(--accent-green-border)';
          elements.dropzoneStatus.style.background = 'rgba(0, 229, 160, 0.12)';
          elements.dropzoneStatus.style.color = 'var(--accent-green)';

          if (elements.dropzoneTip) {
            elements.dropzoneTip.style.display = 'none';
          }
        }
      }

      updateCalculations();
      
      if (meta.isModelOnly) {
        showToast(`Projeto 3D importado! Estimativas de ~${meta.weightGrams}g aplicadas.`, '💡');
      } else {
        showToast(`Arquivo fatiado importado! (${meta.slicer})`, '⚡');
      }
    } else {
      showToast('Tempo ou peso não detectados. O arquivo precisa conter comentários de fatiador.', '⚠️');
    }
  } catch (err) {
    console.error('Erro ao ler arquivo fatiado:', err);
    showToast('Erro ao ler arquivo.', '❌');
  }
}

// Histórico de Peças Salvas
function saveCalculation() {
  syncStateFromInputs();
  const result = engine.computeCostsForPrice(state.salePrice, state);

  const item = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    name: state.productName,
    state: { ...state },
    salePrice: state.salePrice,
    netProfit: result.netProfit,
    netMargin: result.netMarginPercent,
    marketplaceName: MARKETPLACE_CONFIG[state.marketplaceKey].name
  };

  savedCalculations.unshift(item);
  try {
    localStorage.setItem('precificadora3d_history', JSON.stringify(savedCalculations));
  } catch (e) {
    console.warn(e);
  }

  showToast(`Cálculo de "${state.productName}" salvo com sucesso!`, '💾');
}

function renderHistory() {
  if (savedCalculations.length === 0) {
    elements.historyList.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 30px; font-size: 13px; line-height: 1.6;">
        Nenhum cálculo salvo ainda.<br>Clique em "Salvar Peça" para manter seus orçamentos guardados!
      </div>
    `;
    return;
  }

  elements.historyList.innerHTML = savedCalculations.map(item => `
    <div class="history-item" data-load-id="${item.id}">
      <div>
        <div class="history-name">${item.name}</div>
        <div class="history-meta">${item.marketplaceName} · ${item.state.weightGrams}g · ${item.date}</div>
      </div>
      <div style="display:flex; align-items:center; gap: 14px;">
        <div>
          <div class="history-profit">${engine.formatCurrency(item.netProfit)}</div>
          <div style="font-size: 12px; font-weight: 700; color: var(--accent-green); text-align: right;">${item.netMargin.toFixed(1)}% margem</div>
        </div>
        <button class="btn-ghost delete-hist-btn" data-delete-id="${item.id}" style="padding: 4px 8px; font-size: 12px; color: var(--accent-red);" title="Excluir">
          ✕
        </button>
      </div>
    </div>
  `).join('');

  elements.historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.delete-hist-btn')) return;
      const id = el.getAttribute('data-load-id');
      loadCalculation(id);
    });
  });

  elements.historyList.querySelectorAll('.delete-hist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-id');
      deleteCalculation(id);
    });
  });
}

function loadCalculation(id) {
  const item = savedCalculations.find(x => x.id === id);
  if (!item) return;

  Object.assign(state, item.state);

  elements.productNameInput.value = state.productName;
  elements.salePriceInput.value = state.salePrice;
  elements.targetMarginInput.value = state.targetMargin;
  elements.weightInput.value = state.weightGrams;
  elements.filamentSelect.value = state.filamentType;
  elements.filamentPriceInput.value = state.filamentPriceKg;
  elements.hoursInput.value = state.printHours;
  elements.minutesInput.value = state.printMinutes;
  elements.printerSelect.value = state.printerId;
  elements.printerWattsInput.value = state.printerWatts;
  elements.kwhCostInput.value = state.costPerKwh;
  elements.packagingInput.value = state.packagingCost;
  elements.insumosInput.value = state.extraInsumosCost;
  elements.machineCostInput.value = state.machineHourCost;
  elements.taxPercentInput.value = state.taxPercent;
  elements.dailyHoursInput.value = state.dailyWorkingHours;
  elements.promoDiscountInput.value = state.promoDiscountPercent;
  elements.shopeeCpfCheckbox.checked = state.isCpfShopee;

  if (elements.batchQtyInput) elements.batchQtyInput.value = state.quantity || 1;
  if (elements.batchDiscountInput) elements.batchDiscountInput.value = state.batchDiscountPercent || 0;

  setMarketplace(state.marketplaceKey);
  elements.historyModal.classList.remove('active');
  showToast(`Cálculo "${item.name}" carregado!`, '📂');
}

function deleteCalculation(id) {
  savedCalculations = savedCalculations.filter(x => x.id !== id);
  try {
    localStorage.setItem('precificadora3d_history', JSON.stringify(savedCalculations));
  } catch (e) {
    console.warn(e);
  }
  renderHistory();
  showToast('Item removido do histórico', '🗑️');
}

// Copiar resumo formatado para o WhatsApp
function copySummaryToClipboard() {
  syncStateFromInputs();
  const r = engine.computeCostsForPrice(state.salePrice, state);
  const promo = engine.calculatePromotion(state.salePrice, state.promoDiscountPercent);
  const mp = MARKETPLACE_CONFIG[state.marketplaceKey];

  let batchSection = '';
  if (state.quantity > 1) {
    const b = engine.computeBatchMetrics(state.salePrice, state.quantity, state, state.batchPackagingType, state.batchDiscountPercent);
    batchSection = `
━━━━━━━━━━━━━━━━━━━━
📦 *PRODUÇÃO EM LOTE:* ${state.quantity} unidades
💰 *Faturamento Total:* ${engine.formatCurrency(b.totalBatchPrice)}
✅ *LUCRO DO LOTE:* ${engine.formatCurrency(b.batchNetProfit)} (${b.batchNetMarginPercent.toFixed(1)}%)
🎯 *Lucro por Peça:* ${engine.formatCurrency(b.unitNetProfit)}
⏱️ *Tempo de Produção:* ${b.totalBatchHours}h (${b.totalPrintDays} dias)
🧵 *Filamento Total:* ${b.totalFilamentKg} kg (~${b.spoolsEstimated} carretel/éis)`;
  }

  const summary = `
📊 *PRECIFICAÇÃO 3D - 3DEcom*
📦 *Produto:* ${state.productName}
🏢 *Canal:* ${mp.name}
━━━━━━━━━━━━━━━━━━━━
🏷️ *Preço Unitário:* ${engine.formatCurrency(state.salePrice)}
└─ Taxa Marketplace: − ${engine.formatCurrency(r.marketplaceFee)}
${r.shippingCost > 0 ? `└─ Frete/Custo Fixo: − ${engine.formatCurrency(r.shippingCost)}\n` : ''}└─ Impostos (${state.taxPercent}%): − ${engine.formatCurrency(r.taxesCost)}
└─ Filamento (${state.weightGrams}g): − ${engine.formatCurrency(r.filamentCost)}
└─ Energia (${state.printHours}h${state.printMinutes}m): − ${engine.formatCurrency(r.electricityCost)}
└─ Embalagem/Insumos: − ${engine.formatCurrency(r.packagingCost + r.insumosCost + r.depreciationCost)}
━━━━━━━━━━━━━━━━━━━━
✅ *LUCRO LÍQUIDO UNITÁRIO:* ${engine.formatCurrency(r.netProfit)} (${r.netMarginPercent.toFixed(1)}%)
⏱️ *Lucro por Hora:* ${engine.formatCurrency(r.netProfit / r.totalHours)}/h
🚀 *Campanha Promocional:* Anunciar por ${engine.formatCurrency(promo.announcedPrice)} com ${state.promoDiscountPercent}% OFF para lucrar o mesmo!${batchSection}
`.trim();

  navigator.clipboard.writeText(summary).then(() => {
    showToast('Resumo completo copiado para o WhatsApp!', '📋');
  }).catch(() => {
    showToast('Não foi possível copiar automaticamente.', '⚠️');
  });
}

// Event Listeners Globais
function setupEventListeners() {
  // Tabs dos marketplaces
  elements.mpTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-mp');
      setMarketplace(key);
    });
  });

  // Radio sub-options do ML
  document.querySelectorAll('input[name="ml-tier"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setMarketplace(e.target.value);
    });
  });

  // Radio sub-options da Shopee
  document.querySelectorAll('input[name="shopee-tier"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setMarketplace(e.target.value);
    });
  });

  // Checkbox CPF Shopee
  elements.shopeeCpfCheckbox.addEventListener('change', () => {
    updateCalculations();
  });

  // Radio da Venda Direta
  document.querySelectorAll('input[name="direta-tier"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.paymentMethodDirect = e.target.value;
      updateCalculations();
    });
  });

  // Troca de modo Preço vs Margem
  elements.modePriceBtn.addEventListener('click', () => {
    state.calcMode = 'price';
    elements.modePriceBtn.classList.add('active');
    elements.modeMarginBtn.classList.remove('active');
    elements.priceInputGroup.style.display = 'block';
    elements.marginInputGroup.style.display = 'none';
    updateCalculations();
  });

  elements.modeMarginBtn.addEventListener('click', () => {
    state.calcMode = 'margin';
    elements.modeMarginBtn.classList.add('active');
    elements.modePriceBtn.classList.remove('active');
    elements.priceInputGroup.style.display = 'none';
    elements.marginInputGroup.style.display = 'block';
    updateCalculations();
  });

  // Quick price pills
  document.querySelectorAll('.quick-pill:not(.batch-pill)').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const val = parseFloat(e.currentTarget.getAttribute('data-price'));
      elements.salePriceInput.value = val.toFixed(2);
      if (state.calcMode === 'margin') {
        elements.modePriceBtn.click();
      }
      updateCalculations();
    });
  });

  // Quick pills do Modo Lote
  elements.batchPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      const qty = parseInt(e.currentTarget.getAttribute('data-qty'), 10);
      if (elements.batchQtyInput) elements.batchQtyInput.value = qty;
      elements.batchPills.forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      updateCalculations();
    });
  });

  // Radio tipo embalagem lote
  document.querySelectorAll('input[name="batch-pack-tier"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateCalculations();
    });
  });

  // Troca de perfil de impressora
  elements.printerSelect.addEventListener('change', (e) => {
    const selected = PRINTER_PROFILES.find(p => p.id === e.target.value);
    state.printerId = e.target.value;
    if (selected) {
      state.printerWatts = selected.watts;
      elements.printerWattsInput.value = selected.watts;
      elements.wattsRow.style.display = selected.id === 'custom' ? 'block' : 'none';
    }
    updateCalculations();
  });

  // Troca de tipo de filamento
  elements.filamentSelect.addEventListener('change', (e) => {
    const selected = FILAMENT_PROFILES.find(f => f.id === e.target.value);
    state.filamentType = e.target.value;
    if (selected) {
      elements.filamentPriceInput.value = selected.defaultPrice.toFixed(2);
      state.filamentPriceKg = selected.defaultPrice;
    }
    updateCalculations();
  });

  // Collapsible cards toggle
  document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      trigger.classList.toggle('open');
      const content = trigger.nextElementSibling;
      if (content) content.classList.toggle('open');
    });
  });

  // G-Code & 3MF Drag & Drop
  if (elements.gcodeDropzone && elements.gcodeFileInput) {
    const dropzone = elements.gcodeDropzone;
    const fileInput = elements.gcodeFileInput;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput && e.target !== elements.btnBrowseGcode) {
        fileInput.click();
      }
    });

    if (elements.btnBrowseGcode) {
      elements.btnBrowseGcode.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files && files.length > 0) {
        await handleGCodeFile(files[0]);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await handleGCodeFile(e.target.files[0]);
      }
    });
  }

  // Mobile Sticky Bar listeners
  if (elements.mobileBtnDetails) {
    elements.mobileBtnDetails.addEventListener('click', () => {
      if (elements.cascadeContainer) {
        elements.cascadeContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (elements.mobileBtnSave) {
    elements.mobileBtnSave.addEventListener('click', saveCalculation);
  }

  // Input listeners para atualização em tempo real
  const liveInputs = [
    elements.productNameInput,
    elements.salePriceInput,
    elements.targetMarginInput,
    elements.weightInput,
    elements.filamentPriceInput,
    elements.hoursInput,
    elements.minutesInput,
    elements.printerWattsInput,
    elements.kwhCostInput,
    elements.packagingInput,
    elements.insumosInput,
    elements.machineCostInput,
    elements.taxPercentInput,
    elements.dailyHoursInput,
    elements.promoDiscountInput,
    elements.batchQtyInput,
    elements.batchDiscountInput
  ].filter(Boolean);

  liveInputs.forEach(input => {
    input.addEventListener('input', () => updateCalculations());
    input.addEventListener('change', () => updateCalculations());
  });

  // Modal de Histórico
  elements.saveCalcBtn.addEventListener('click', saveCalculation);
  elements.copySummaryBtn.addEventListener('click', copySummaryToClipboard);

  elements.historyBtn.addEventListener('click', () => {
    renderHistory();
    elements.historyModal.classList.add('active');
  });

  elements.closeHistoryBtn.addEventListener('click', () => {
    elements.historyModal.classList.remove('active');
  });

  // Modal de Preferências
  elements.prefsBtn.addEventListener('click', () => {
    elements.prefsModal.classList.add('active');
  });

  elements.closePrefsBtn.addEventListener('click', () => {
    elements.prefsModal.classList.remove('active');
  });

  elements.savePrefsBtn.addEventListener('click', () => {
    const newPrefs = {
      defaultPrinterId: elements.prefPrinterSelect.value,
      defaultKwhCost: parseFloat(elements.prefKwhInput.value) || 0.85,
      defaultTaxPercent: parseFloat(elements.prefTaxInput.value) || 6.0,
      defaultPackagingCost: parseFloat(elements.prefPackagingInput.value) || 2.38
    };
    engine.savePreferences(newPrefs);
    elements.prefsModal.classList.remove('active');
    showToast('Preferências salvas!', '⚙️');
    initializeSelectors();
    updateCalculations();
  });

  // Fechar modais ao clicar no overlay
  window.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) elements.historyModal.classList.remove('active');
    if (e.target === elements.prefsModal) elements.prefsModal.classList.remove('active');
  });
}

// Inicialização Geral
window.addEventListener('DOMContentLoaded', () => {
  initializeSelectors();
  setupEventListeners();
  updateCalculations();
});

import { PRINTER_PROFILES, FILAMENT_PROFILES, MARKETPLACE_CONFIG } from './presets.js';
import { PricingEngine } from './calculator.js';
import { GCodeParser } from './gcodeParser.js';

// Inicialização da engine de cálculo
const engine = new PricingEngine();

// Estado da aplicação (Inicia ZERADO até o usuário subir um arquivo ou digitar dados)
const state = {
  marketplaceKey: 'ml_premium',
  calcMode: 'margin', // 'margin' ou 'price'
  productName: '',
  salePrice: 0,
  targetMargin: 50.0,
  weightGrams: 0,
  filamentType: 'pla',
  filamentPriceKg: 80.00,
  printHours: 0,
  printMinutes: 0,
  printerId: 'bambu-p1s',
  printerWatts: 120,
  costPerKwh: 0.85,
  packagingCost: 1.50,
  machineHourCost: 0.50,
  extraInsumosCost: 0.00,
  taxPercent: 6.0,
  isCpfShopee: false,
  paymentMethodDirect: 'pix',
  cardFeePercentDirect: 3.5,
  dailyWorkingHours: 20,
  promoDiscountPercent: 10.0,
  customShipping: null,
  fileUploaded: false,
  quantity: 1,
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
  // Tabs dos Marketplaces
  mpTabs: document.querySelectorAll('.mp-tab'),
  mlSubOptions: document.getElementById('ml-sub-options'),
  shopeeSubOptions: document.getElementById('shopee-sub-options'),
  diretaSubOptions: document.getElementById('direta-sub-options'),

  // Modos de Precificação (Margem % vs Preço R$)
  modePriceBtn: document.getElementById('mode-price-btn'),
  modeMarginBtn: document.getElementById('mode-margin-btn'),
  priceInputGroup: document.getElementById('price-input-group'),
  marginInputGroup: document.getElementById('margin-input-group'),
  marginPills: document.querySelectorAll('.margin-pill'),
  pricePills: document.querySelectorAll('.price-pill'),

  // Inputs da Peça & Oficina
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

  // G-Code & 3MF Dropzone
  gcodeDropzone: document.getElementById('gcode-dropzone'),
  gcodeFileInput: document.getElementById('gcode-file-input'),
  btnBrowseGcode: document.getElementById('btn-browse-gcode'),
  dropzoneStatus: document.getElementById('dropzone-status'),
  dropzoneStatusIcon: document.getElementById('dropzone-status-icon'),
  dropzoneStatusText: document.getElementById('dropzone-status-text'),
  dropzoneTip: document.getElementById('dropzone-tip'),

  // Formação de Kits / Lote
  batchQtyInput: document.getElementById('batch-qty-input'),
  batchPills: document.querySelectorAll('.batch-pill'),
  batchActiveBadge: document.getElementById('batch-active-badge'),

  // Equação do Custo de Fabricação (Passo 1)
  prodEquationBox: document.getElementById('prod-equation-box'),
  prodEquationBadge: document.getElementById('prod-equation-badge'),
  prodTotalCost: document.getElementById('prod-total-cost'),
  prodFilamentCost: document.getElementById('prod-filament-cost'),
  prodEnergyCost: document.getElementById('prod-energy-cost'),
  prodPackCost: document.getElementById('prod-pack-cost'),
  prodDeprecCost: document.getElementById('prod-deprec-cost'),
  prodUnitHint: document.getElementById('prod-unit-hint'),

  // Card Principal de Precificação Clara & Segura (Passo 3)
  pricingHeroResult: document.getElementById('pricing-hero-result'),
  resultSalePrice: document.getElementById('result-sale-price'),
  netProfitBig: document.getElementById('net-profit-big'),
  netMarginBig: document.getElementById('net-margin-big'),
  marginBadge: document.getElementById('margin-badge'),
  pricingCostFabricacao: document.getElementById('pricing-cost-fabricacao'),
  pricingCostTaxas: document.getElementById('pricing-cost-taxas'),
  pricingLucroResumo: document.getElementById('pricing-lucro-resumo'),

  // Sugestões Rápidas (Bom Preço vs Preço Ideal)
  cardGoodPrice: document.getElementById('card-good-price'),
  smartGoodPrice: document.getElementById('smart-good-price'),
  smartGoodProfit: document.getElementById('smart-good-profit'),
  smartGoodMargin: document.getElementById('smart-good-margin'),
  btnUseGoodPrice: document.getElementById('btn-use-good-price'),
  tagGoodActive: document.getElementById('tag-good-active'),

  cardIdealPrice: document.getElementById('card-ideal-price'),
  smartIdealPrice: document.getElementById('smart-ideal-price'),
  smartIdealProfit: document.getElementById('smart-ideal-profit'),
  smartIdealMargin: document.getElementById('smart-ideal-margin'),
  btnUseIdealPrice: document.getElementById('btn-use-ideal-price'),
  tagIdealActive: document.getElementById('tag-ideal-active'),

  // Tabela Comparativa de Canais (Passo 4)
  matrixBody: document.getElementById('matrix-body'),

  // Mobile Sticky Bar
  mobileStickyBar: document.getElementById('mobile-sticky-bar'),
  mobileChannelTag: document.getElementById('mobile-channel-tag'),
  mobileProfitVal: document.getElementById('mobile-profit-val'),
  mobileMarginBadge: document.getElementById('mobile-margin-badge'),
  mobileBtnDetails: document.getElementById('mobile-btn-details'),
  mobileBtnSave: document.getElementById('mobile-btn-save'),

  // Botões & Modais
  resetCalcBtn: document.getElementById('btn-reset-calc'),
  quickResetBtn: document.getElementById('btn-quick-reset'),
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

// Popula os selects com perfis pré-configurados
function initializeSelectors() {
  if (elements.printerSelect) {
    elements.printerSelect.innerHTML = PRINTER_PROFILES.map(p => 
      `<option value="${p.id}">${p.name} (${p.watts}W)</option>`
    ).join('');
  }

  if (elements.prefPrinterSelect && elements.printerSelect) {
    elements.prefPrinterSelect.innerHTML = elements.printerSelect.innerHTML;
  }

  if (elements.filamentSelect) {
    elements.filamentSelect.innerHTML = FILAMENT_PROFILES.map(f => 
      `<option value="${f.id}">${f.name}</option>`
    ).join('');
  }

  // Aplica preferências salvas pelo usuário
  const prefs = engine.preferences;
  if (prefs.defaultPrinterId) {
    state.printerId = prefs.defaultPrinterId;
    if (elements.printerSelect) elements.printerSelect.value = prefs.defaultPrinterId;
    if (elements.prefPrinterSelect) elements.prefPrinterSelect.value = prefs.defaultPrinterId;
    const p = PRINTER_PROFILES.find(x => x.id === prefs.defaultPrinterId);
    if (p) state.printerWatts = p.watts;
  }
  if (prefs.defaultKwhCost) {
    state.costPerKwh = prefs.defaultKwhCost;
    if (elements.kwhCostInput) elements.kwhCostInput.value = prefs.defaultKwhCost;
    if (elements.prefKwhInput) elements.prefKwhInput.value = prefs.defaultKwhCost;
  }
  if (prefs.defaultTaxPercent) {
    state.taxPercent = prefs.defaultTaxPercent;
    if (elements.taxPercentInput) elements.taxPercentInput.value = prefs.defaultTaxPercent;
    if (elements.prefTaxInput) elements.prefTaxInput.value = prefs.defaultTaxPercent;
  }
  if (prefs.defaultPackagingCost) {
    state.packagingCost = prefs.defaultPackagingCost;
    if (elements.packagingInput) elements.packagingInput.value = prefs.defaultPackagingCost;
    if (elements.prefPackagingInput) elements.prefPackagingInput.value = prefs.defaultPackagingCost;
  }
}

// Exibe notificação flutuante tipo Toast
function showToast(message, icon = '✓') {
  if (!elements.toastContainer) return;
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

// Sincroniza dados da tela para o objeto state
function syncStateFromInputs() {
  if (elements.productNameInput) state.productName = elements.productNameInput.value.trim() || 'Peça Impressa 3D';
  if (elements.weightInput) state.weightGrams = parseFloat(elements.weightInput.value) || 0;
  if (elements.filamentPriceInput) state.filamentPriceKg = parseFloat(elements.filamentPriceInput.value) || 80.00;
  if (elements.hoursInput) state.printHours = parseInt(elements.hoursInput.value, 10) || 0;
  if (elements.minutesInput) state.printMinutes = parseInt(elements.minutesInput.value, 10) || 0;
  if (elements.kwhCostInput) state.costPerKwh = parseFloat(elements.kwhCostInput.value) || 0.85;
  if (elements.packagingInput) state.packagingCost = parseFloat(elements.packagingInput.value) || 1.50;
  if (elements.insumosInput) state.extraInsumosCost = parseFloat(elements.insumosInput.value) || 0;
  if (elements.machineCostInput) state.machineHourCost = parseFloat(elements.machineCostInput.value) || 0.50;
  if (elements.taxPercentInput) state.taxPercent = parseFloat(elements.taxPercentInput.value) || 6.0;

  // Lote / Kit
  if (elements.batchQtyInput) state.quantity = parseInt(elements.batchQtyInput.value, 10) || 1;

  if (state.printerId === 'custom' && elements.printerWattsInput) {
    state.printerWatts = parseFloat(elements.printerWattsInput.value) || 120;
  }

  if (state.calcMode === 'price') {
    if (elements.salePriceInput) state.salePrice = parseFloat(elements.salePriceInput.value) || 0;
  } else {
    if (elements.targetMarginInput) state.targetMargin = parseFloat(elements.targetMarginInput.value) || 0;
  }
}

// Verifica se há especificações de produção da peça preenchidas
function hasActiveSpecs(s) {
  return (s.weightGrams > 0) || (s.printHours > 0 || s.printMinutes > 0) || s.fileUploaded;
}

// Verifica se há produto ativo para calcular
function hasActiveProduct(s) {
  const hasSpecs = hasActiveSpecs(s);
  if (!hasSpecs) return false;
  return s.calcMode === 'margin' ? (s.targetMargin > 0) : (s.salePrice > 0);
}

// Renderiza os cálculos e atualiza a interface de forma clara e direta
function updateCalculations() {
  syncStateFromInputs();
  const specsActive = hasActiveSpecs(state);

  // 1. Equação do Custo de Fabricação (Unitário ou Kit)
  const prodEq = engine.computeProductionEquation(state, state.quantity, state.batchPackagingType);
  const smartRecs = engine.computeSmartRecommendations(state, state.quantity, state.batchPackagingType);

  // Atualiza painel do Passo 1 (Custo Total de Fabricação)
  if (elements.prodTotalCost) {
    elements.prodTotalCost.textContent = engine.formatCurrency(specsActive ? prodEq.totalProductionCost : 0);
  }
  if (elements.prodFilamentCost) {
    elements.prodFilamentCost.textContent = engine.formatCurrency(specsActive ? prodEq.totalFilamentCost : 0);
  }
  if (elements.prodEnergyCost) {
    elements.prodEnergyCost.textContent = engine.formatCurrency(specsActive ? prodEq.totalElectricityCost : 0);
  }
  if (elements.prodPackCost) {
    elements.prodPackCost.textContent = engine.formatCurrency(specsActive ? (prodEq.effectivePackagingCost + prodEq.totalInsumosCost) : 0);
  }
  if (elements.prodDeprecCost) {
    elements.prodDeprecCost.textContent = engine.formatCurrency(specsActive ? prodEq.totalDepreciationCost : 0);
  }
  if (elements.prodEquationBadge) {
    elements.prodEquationBadge.textContent = state.quantity > 1 
      ? `KIT COM ${state.quantity} UNIDADES (${state.quantity}x)` 
      : '1 UNIDADE';
  }
  if (elements.prodUnitHint) {
    if (specsActive && state.quantity > 1) {
      elements.prodUnitHint.style.display = 'block';
      elements.prodUnitHint.textContent = `Equivale a ${engine.formatCurrency(prodEq.unitProductionCost)} de custo de fabricação por peça`;
    } else {
      elements.prodUnitHint.style.display = 'none';
    }
  }

  // Sincroniza visualmente as pills de Kit/Quantidade
  if (elements.batchPills) {
    elements.batchPills.forEach(p => {
      const pQty = parseInt(p.getAttribute('data-qty'), 10);
      p.classList.toggle('active', pQty === state.quantity);
    });
  }

  // 2. Atualiza Cards Inteligentes de Precificação (Bom Preço vs Preço Ideal)
  if (elements.smartGoodPrice) {
    elements.smartGoodPrice.textContent = engine.formatCurrency(specsActive ? smartRecs.goodPrice.price : 0);
  }
  if (elements.smartGoodProfit) {
    elements.smartGoodProfit.textContent = engine.formatCurrency(specsActive ? smartRecs.goodPrice.netProfit : 0);
  }
  if (elements.smartGoodMargin) {
    elements.smartGoodMargin.textContent = specsActive ? engine.formatPercent(smartRecs.goodPrice.netMarginPercent) : '0,0%';
  }

  if (elements.smartIdealPrice) {
    elements.smartIdealPrice.textContent = engine.formatCurrency(specsActive ? smartRecs.idealPrice.price : 0);
  }
  if (elements.smartIdealProfit) {
    elements.smartIdealProfit.textContent = engine.formatCurrency(specsActive ? smartRecs.idealPrice.netProfit : 0);
  }
  if (elements.smartIdealMargin) {
    elements.smartIdealMargin.textContent = specsActive ? engine.formatPercent(smartRecs.idealPrice.netMarginPercent) : '0,0%';
  }

  const isActive = hasActiveProduct(state);

  // --- ESTADO ZERADO (Aguardando dados da peça) ---
  if (!isActive) {
    if (elements.resultSalePrice) elements.resultSalePrice.textContent = 'R$ 0,00';
    if (elements.netProfitBig) {
      elements.netProfitBig.textContent = 'R$ 0,00';
      elements.netProfitBig.style.color = 'var(--text-muted)';
    }
    if (elements.netMarginBig) {
      elements.netMarginBig.textContent = '0,0% de margem real';
      elements.netMarginBig.style.color = 'var(--text-muted)';
    }
    if (elements.marginBadge) {
      elements.marginBadge.textContent = 'Aguardando Peça';
      elements.marginBadge.style.color = 'var(--text-dim)';
      elements.marginBadge.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
    }
    if (elements.pricingCostFabricacao) elements.pricingCostFabricacao.textContent = 'R$ 0,00';
    if (elements.pricingCostTaxas) elements.pricingCostTaxas.textContent = 'R$ 0,00';
    if (elements.pricingLucroResumo) {
      elements.pricingLucroResumo.textContent = 'R$ 0,00';
      elements.pricingLucroResumo.style.color = 'var(--text-muted)';
    }

    if (elements.batchActiveBadge) elements.batchActiveBadge.style.display = 'none';
    if (elements.cardGoodPrice) elements.cardGoodPrice.classList.remove('active');
    if (elements.tagGoodActive) elements.tagGoodActive.style.display = 'none';
    if (elements.cardIdealPrice) elements.cardIdealPrice.classList.remove('active');
    if (elements.tagIdealActive) elements.tagIdealActive.style.display = 'none';

    renderMultiChannelMatrix(0, false);

    if (elements.mobileStickyBar) {
      if (elements.mobileProfitVal) {
        elements.mobileProfitVal.textContent = 'R$ 0,00';
        elements.mobileProfitVal.style.color = 'var(--text-muted)';
      }
      if (elements.mobileMarginBadge) {
        elements.mobileMarginBadge.textContent = '0,0%';
        elements.mobileMarginBadge.style.color = 'var(--text-muted)';
      }
    }
    return;
  }

  // --- ESTADO ATIVO: CÁLCULO PRECISO & DIRETO ---
  const kitInputs = {
    ...state,
    weightGrams: prodEq.totalWeightGrams,
    printHours: Math.floor(prodEq.totalPrintHours),
    printMinutes: Math.round((prodEq.totalPrintHours % 1) * 60),
    packagingCost: prodEq.effectivePackagingCost,
    extraInsumosCost: prodEq.totalInsumosCost,
    machineHourCost: state.machineHourCost
  };

  let effectivePrice = state.salePrice;

  // Se o usuário quer definir pela Margem (ex: 30%, 40%, 50%), calcula o preço exato que cobre tudo:
  if (state.calcMode === 'margin') {
    effectivePrice = engine.findPriceForTargetMargin(state.targetMargin, kitInputs);
    state.salePrice = effectivePrice;
    if (elements.salePriceInput) elements.salePriceInput.value = effectivePrice > 0 ? effectivePrice.toFixed(2) : '';
  }

  // Calcula comissão, taxas fixas, frete, imposto e lucro líquido
  const result = engine.computeCostsForPrice(effectivePrice, kitInputs);

  // 1. Atualiza Hero Box (Preço de Venda do Anúncio & Lucro Líquido no Bolso)
  if (elements.resultSalePrice) {
    elements.resultSalePrice.textContent = engine.formatCurrency(effectivePrice);
  }

  if (elements.netProfitBig) {
    elements.netProfitBig.textContent = engine.formatCurrency(result.netProfit);
    elements.netProfitBig.style.color = result.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  if (elements.netMarginBig) {
    elements.netMarginBig.textContent = `${engine.formatPercent(result.netMarginPercent)} de margem real`;
    elements.netMarginBig.style.color = result.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  const marginClass = engine.getMarginClassification(result.netMarginPercent);
  if (elements.marginBadge) {
    elements.marginBadge.textContent = marginClass.label;
    elements.marginBadge.style.color = marginClass.color;
    elements.marginBadge.style.backgroundColor = marginClass.bg;
  }

  // 2. Decomposição em 1 Linha (Fabricação + Taxas Canal = Sobra Líquido)
  if (elements.pricingCostFabricacao) {
    elements.pricingCostFabricacao.textContent = engine.formatCurrency(prodEq.totalProductionCost);
  }
  if (elements.pricingCostTaxas) {
    const totalTaxas = result.marketplaceFee + result.shippingCost + result.taxesCost;
    elements.pricingCostTaxas.textContent = engine.formatCurrency(totalTaxas);
  }
  if (elements.pricingLucroResumo) {
    elements.pricingLucroResumo.textContent = engine.formatCurrency(result.netProfit);
    elements.pricingLucroResumo.style.color = result.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  // 3. Sincroniza atalhos de Margem (%)
  if (elements.marginPills) {
    elements.marginPills.forEach(pill => {
      const mVal = parseFloat(pill.getAttribute('data-margin'));
      pill.classList.toggle('active', state.calcMode === 'margin' && Math.abs(mVal - state.targetMargin) < 0.5);
    });
  }

  // 4. Sincroniza sugestões de Preço (R$)
  if (elements.pricePills) {
    elements.pricePills.forEach(pill => {
      const pVal = parseFloat(pill.getAttribute('data-price'));
      pill.classList.toggle('active', state.calcMode === 'price' && Math.abs(pVal - state.salePrice) < 0.15);
    });
  }

  // 5. Ativação visual dos cards de recomendação
  const isGoodActive = specsActive && Math.abs(effectivePrice - smartRecs.goodPrice.price) < 0.20;
  const isIdealActive = specsActive && Math.abs(effectivePrice - smartRecs.idealPrice.price) < 0.20;

  if (elements.cardGoodPrice) elements.cardGoodPrice.classList.toggle('active', isGoodActive);
  if (elements.tagGoodActive) elements.tagGoodActive.style.display = isGoodActive ? 'inline-block' : 'none';
  if (elements.cardIdealPrice) elements.cardIdealPrice.classList.toggle('active', isIdealActive);
  if (elements.tagIdealActive) elements.tagIdealActive.style.display = isIdealActive ? 'inline-block' : 'none';

  // 6. Badge de Kit
  if (elements.batchActiveBadge) {
    if (state.quantity > 1) {
      elements.batchActiveBadge.style.display = 'inline-block';
      elements.batchActiveBadge.textContent = `Kit ${state.quantity} un`;
    } else {
      elements.batchActiveBadge.style.display = 'none';
    }
  }

  // 7. Comparativo Multicanal Completo (Passo 4)
  renderMultiChannelMatrix(effectivePrice, true, kitInputs);

  // 8. Barra Mobile Flutuante
  if (elements.mobileStickyBar) {
    const mp = MARKETPLACE_CONFIG[state.marketplaceKey];
    if (elements.mobileChannelTag) elements.mobileChannelTag.textContent = mp ? (mp.subTag || mp.tag) : 'Ativo';
    
    if (elements.mobileProfitVal) {
      elements.mobileProfitVal.textContent = engine.formatCurrency(result.netProfit);
      elements.mobileProfitVal.style.color = result.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }
    if (elements.mobileMarginBadge) {
      elements.mobileMarginBadge.textContent = engine.formatPercent(result.netMarginPercent);
    }
  }
}

// Renderiza a matriz comparativa de canais de venda (Passo 4)
function renderMultiChannelMatrix(currentPrice, isActive = true, activeInputs = state) {
  if (!elements.matrixBody) return;

  const channels = [
    { key: 'ml_premium', name: 'Mercado Livre Premium', icon: '🟡' },
    { key: 'ml_classico', name: 'Mercado Livre Clássico', icon: '🟡' },
    { key: 'shopee_fge', name: 'Shopee (FGE 2026)', icon: '🟠' },
    { key: 'tiktok_shop', name: 'TikTok Shop', icon: '🎵' },
    { key: 'venda_direta', name: 'Venda Física / Direta (Pix 0%)', icon: '🟢' }
  ];

  if (!isActive) {
    elements.matrixBody.innerHTML = channels.map(ch => {
      const isCurrent = state.marketplaceKey === ch.key;
      return `
        <tr style="${isCurrent ? 'background: rgba(255,255,255,0.03);' : ''}">
          <td>
            <span class="channel-name">
              <span>${ch.icon}</span> ${ch.name}
              ${isCurrent ? '<span style="color:var(--text-dim); font-size:10px; margin-left:6px;">(Ativo)</span>' : ''}
            </span>
          </td>
          <td class="mono" style="color: var(--text-dim);">R$ 0,00</td>
          <td class="mono" style="color: var(--text-dim);">− R$ 0,00</td>
          <td class="mono" style="color: var(--text-dim);">R$ 0,00</td>
          <td>
            <span style="color: var(--text-dim);" class="mono">0,0%</span>
          </td>
          <td>
            <span style="font-size: 11px; color: var(--text-dim);">Aguardando</span>
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  elements.matrixBody.innerHTML = channels.map(ch => {
    const calcCopy = { ...activeInputs, marketplaceKey: ch.key };
    const r = engine.computeCostsForPrice(currentPrice, calcCopy);
    const m = engine.getMarginClassification(r.netMarginPercent);
    const isCurrent = state.marketplaceKey === ch.key;

    return `
      <tr style="${isCurrent ? 'background: rgba(0,229,160,0.07); font-weight: bold;' : ''}">
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
            ${isCurrent ? 'Selecionado' : 'Simular'}
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
  if (elements.mpTabs) {
    elements.mpTabs.forEach(tab => {
      if (tab.getAttribute('data-mp') === key) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // Mostra/Oculta sub-opções
  if (key === 'ml_premium' || key === 'ml_classico') {
    if (elements.mlSubOptions) elements.mlSubOptions.style.display = 'flex';
    if (elements.shopeeSubOptions) elements.shopeeSubOptions.style.display = 'none';
    if (elements.diretaSubOptions) elements.diretaSubOptions.style.display = 'none';
    const radio = document.querySelector(`input[name="ml-tier"][value="${key}"]`);
    if (radio) radio.checked = true;
  } else if (key === 'shopee_fge' || key === 'shopee_padrao') {
    if (elements.mlSubOptions) elements.mlSubOptions.style.display = 'none';
    if (elements.shopeeSubOptions) elements.shopeeSubOptions.style.display = 'flex';
    if (elements.diretaSubOptions) elements.diretaSubOptions.style.display = 'none';
    const radio = document.querySelector(`input[name="shopee-tier"][value="${key}"]`);
    if (radio) radio.checked = true;
  } else if (key === 'venda_direta') {
    if (elements.mlSubOptions) elements.mlSubOptions.style.display = 'none';
    if (elements.shopeeSubOptions) elements.shopeeSubOptions.style.display = 'none';
    if (elements.diretaSubOptions) elements.diretaSubOptions.style.display = 'flex';
  } else {
    // tiktok_shop
    if (elements.mlSubOptions) elements.mlSubOptions.style.display = 'none';
    if (elements.shopeeSubOptions) elements.shopeeSubOptions.style.display = 'none';
    if (elements.diretaSubOptions) elements.diretaSubOptions.style.display = 'none';
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
        if (elements.productNameInput) elements.productNameInput.value = meta.cleanName;
        state.productName = meta.cleanName;
      }
      if (meta.hours > 0 || meta.minutes > 0) {
        if (elements.hoursInput) elements.hoursInput.value = meta.hours;
        if (elements.minutesInput) elements.minutesInput.value = meta.minutes;
        state.printHours = meta.hours;
        state.printMinutes = meta.minutes;
      }
      if (meta.weightGrams > 0) {
        if (elements.weightInput) elements.weightInput.value = meta.weightGrams;
        state.weightGrams = meta.weightGrams;
      }
      if (meta.filamentType) {
        if (elements.filamentSelect) elements.filamentSelect.value = meta.filamentType;
        const prof = FILAMENT_PROFILES.find(f => f.id === meta.filamentType);
        if (prof && elements.filamentPriceInput) {
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
            if (elements.printerWattsInput) elements.printerWattsInput.value = prof.watts;
          }
        }
      }

      if (elements.dropzoneStatus) {
        elements.dropzoneStatus.style.display = 'flex';
        if (meta.isModelOnly) {
          if (elements.dropzoneStatusIcon) elements.dropzoneStatusIcon.textContent = '💡';
          if (elements.dropzoneStatusText) {
            elements.dropzoneStatusText.textContent = `Projeto 3D: "${meta.cleanName}" (${meta.dimensions || ''}) · Estimativa: ~${meta.weightGrams}g · ~${meta.rawTimeStr}`;
          }
          elements.dropzoneStatus.style.borderColor = 'rgba(56, 189, 248, 0.4)';
          elements.dropzoneStatus.style.background = 'rgba(56, 189, 248, 0.12)';
          elements.dropzoneStatus.style.color = 'var(--accent-blue)';

          if (elements.dropzoneTip) {
            elements.dropzoneTip.style.display = 'block';
            elements.dropzoneTip.innerHTML = `
              <strong>ℹ️ Projeto 3D (.3MF) Detectado:</strong> Contém o modelo 3D com estimativa de ~${meta.weightGrams}g e ~${meta.rawTimeStr}.<br>
              ⚡ Para peso e tempo 100% exatos do Bambu Studio: clique na setinha ▾ ao lado de "Imprimir" e escolha "Exportar arquivo fatiado de mesa" (.gcode.3mf).
            `;
          }
        } else {
          if (elements.dropzoneStatusIcon) elements.dropzoneStatusIcon.textContent = '✓';
          if (elements.dropzoneStatusText) {
            elements.dropzoneStatusText.textContent = `${meta.slicer}: ${meta.rawTimeStr || (meta.hours + 'h ' + meta.minutes + 'm')} · ${meta.weightGrams}g ${meta.filamentType ? '· ' + meta.filamentType.toUpperCase() : ''}`;
          }
          elements.dropzoneStatus.style.borderColor = 'var(--accent-green-border)';
          elements.dropzoneStatus.style.background = 'rgba(0, 229, 160, 0.12)';
          elements.dropzoneStatus.style.color = 'var(--accent-green)';

          if (elements.dropzoneTip) {
            elements.dropzoneTip.style.display = 'none';
          }
        }
      }

      state.fileUploaded = true;

      // Se estiver em modo de preço e estiver 0, sugere o Preço Ideal
      if (state.calcMode === 'price') {
        const currentPriceVal = parseFloat(elements.salePriceInput?.value) || 0;
        if (currentPriceVal === 0) {
          const smartRecs = engine.computeSmartRecommendations(state, state.quantity, state.batchPackagingType);
          if (smartRecs.idealPrice && smartRecs.idealPrice.price > 0) {
            if (elements.salePriceInput) elements.salePriceInput.value = smartRecs.idealPrice.price.toFixed(2);
            state.salePrice = smartRecs.idealPrice.price;
          }
        }
      }

      updateCalculations();
      
      if (meta.isModelOnly) {
        showToast(`Projeto 3D importado! Estimativas de ~${meta.weightGrams}g aplicadas.`, '💡');
      } else {
        showToast(`Arquivo fatiado importado com sucesso!`, '⚡');
      }
    } else {
      showToast('Tempo ou peso não detectados. O arquivo precisa conter comentários de fatiador.', '⚠️');
    }
  } catch (err) {
    console.error('Erro ao ler arquivo fatiado:', err);
    showToast('Erro ao ler arquivo.', '❌');
  }
}

// Zera a ferramenta e limpa todos os dados para uma nova peça
function resetCalculation() {
  state.fileUploaded = false;
  state.productName = '';
  state.salePrice = 0;
  state.weightGrams = 0;
  state.printHours = 0;
  state.printMinutes = 0;
  state.quantity = 1;
  state.targetMargin = 50.0;

  if (elements.productNameInput) elements.productNameInput.value = '';
  if (elements.salePriceInput) elements.salePriceInput.value = '';
  if (elements.targetMarginInput) elements.targetMarginInput.value = '50';
  if (elements.hoursInput) elements.hoursInput.value = '';
  if (elements.minutesInput) elements.minutesInput.value = '';
  if (elements.weightInput) elements.weightInput.value = '';
  if (elements.batchQtyInput) elements.batchQtyInput.value = 1;
  if (elements.gcodeFileInput) elements.gcodeFileInput.value = '';

  if (elements.dropzoneStatus) elements.dropzoneStatus.style.display = 'none';
  if (elements.dropzoneTip) elements.dropzoneTip.style.display = 'none';

  updateCalculations();
  showToast('Campos limpos! Pronta para nova peça.', '🔄');
}

// Histórico de Peças Salvas
function saveCalculation() {
  syncStateFromInputs();
  if (!hasActiveProduct(state)) {
    showToast('Suba um arquivo ou preencha os dados da peça antes de salvar.', '⚠️');
    return;
  }
  const result = engine.computeCostsForPrice(state.salePrice, state);

  const item = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    name: state.productName || 'Peça Impressa 3D',
    state: { ...state },
    salePrice: state.salePrice,
    netProfit: result.netProfit,
    netMargin: result.netMarginPercent,
    marketplaceName: MARKETPLACE_CONFIG[state.marketplaceKey]?.name || 'Marketplace'
  };

  savedCalculations.unshift(item);
  try {
    localStorage.setItem('precificadora3d_history', JSON.stringify(savedCalculations));
  } catch (e) {
    console.warn(e);
  }

  showToast(`Cálculo de "${item.name}" salvo com sucesso!`, '💾');
}

function renderHistory() {
  if (!elements.historyList) return;

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

  if (elements.productNameInput) elements.productNameInput.value = state.productName;
  if (elements.salePriceInput) elements.salePriceInput.value = state.salePrice;
  if (elements.targetMarginInput) elements.targetMarginInput.value = state.targetMargin;
  if (elements.weightInput) elements.weightInput.value = state.weightGrams;
  if (elements.filamentSelect) elements.filamentSelect.value = state.filamentType;
  if (elements.filamentPriceInput) elements.filamentPriceInput.value = state.filamentPriceKg;
  if (elements.hoursInput) elements.hoursInput.value = state.printHours;
  if (elements.minutesInput) elements.minutesInput.value = state.printMinutes;
  if (elements.printerSelect) elements.printerSelect.value = state.printerId;
  if (elements.printerWattsInput) elements.printerWattsInput.value = state.printerWatts;
  if (elements.kwhCostInput) elements.kwhCostInput.value = state.costPerKwh;
  if (elements.packagingInput) elements.packagingInput.value = state.packagingCost;
  if (elements.insumosInput) elements.insumosInput.value = state.extraInsumosCost;
  if (elements.machineCostInput) elements.machineCostInput.value = state.machineHourCost;
  if (elements.taxPercentInput) elements.taxPercentInput.value = state.taxPercent;
  if (elements.batchQtyInput) elements.batchQtyInput.value = state.quantity || 1;

  if (state.calcMode === 'price' && elements.modePriceBtn) {
    elements.modePriceBtn.click();
  } else if (elements.modeMarginBtn) {
    elements.modeMarginBtn.click();
  }

  setMarketplace(state.marketplaceKey);
  if (elements.historyModal) elements.historyModal.classList.remove('active');
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
  if (!hasActiveProduct(state)) {
    showToast('Suba um arquivo ou preencha os dados da peça antes de copiar o resumo.', '⚠️');
    return;
  }
  const r = engine.computeCostsForPrice(state.salePrice, state);
  const mp = MARKETPLACE_CONFIG[state.marketplaceKey] || { name: 'Marketplace' };

  let kitSection = '';
  if (state.quantity > 1) {
    kitSection = `
━━━━━━━━━━━━━━━━━━━━
📦 *KIT COM ${state.quantity} UNIDADES*
💰 Preço Total do Kit: ${engine.formatCurrency(state.salePrice)}
✅ Lucro Total do Kit: ${engine.formatCurrency(r.netProfit)} (${r.netMarginPercent.toFixed(1)}%)
🎯 Lucro por Unidade: ${engine.formatCurrency(r.netProfit / state.quantity)}`;
  }

  const summary = `
📊 *PRECIFICAÇÃO 3D - Plataforma3D*
📦 *Produto:* ${state.productName || 'Peça Impressa 3D'}
🏢 *Canal:* ${mp.name}
━━━━━━━━━━━━━━━━━━━━
🏷️ *Preço de Venda:* ${engine.formatCurrency(state.salePrice)}
└─ Taxa do Canal: − ${engine.formatCurrency(r.marketplaceFee)}
${r.shippingCost > 0 ? `└─ Frete / Custo Fixo: − ${engine.formatCurrency(r.shippingCost)}\n` : ''}└─ Impostos (${state.taxPercent}%): − ${engine.formatCurrency(r.taxesCost)}
└─ Filamento (${state.weightGrams}g): − ${engine.formatCurrency(r.filamentCost)}
└─ Energia (${state.printHours}h${state.printMinutes}m): − ${engine.formatCurrency(r.electricityCost)}
└─ Embalagem & Manutenção: − ${engine.formatCurrency(r.packagingCost + r.insumosCost + r.depreciationCost)}
━━━━━━━━━━━━━━━━━━━━
✅ *LUCRO LÍQUIDO NO BOLSO:* ${engine.formatCurrency(r.netProfit)} (${r.netMarginPercent.toFixed(1)}% de margem real)${kitSection}
`.trim();

  navigator.clipboard.writeText(summary).then(() => {
    showToast('Resumo copiado para o WhatsApp!', '📋');
  }).catch(() => {
    showToast('Não foi possível copiar automaticamente.', '⚠️');
  });
}

// Configura todos os Event Listeners da página
function setupEventListeners() {
  // Tabs dos marketplaces
  if (elements.mpTabs) {
    elements.mpTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.getAttribute('data-mp');
        setMarketplace(key);
      });
    });
  }

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

  // Radio da Venda Direta
  document.querySelectorAll('input[name="direta-tier"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.paymentMethodDirect = e.target.value;
      updateCalculations();
    });
  });

  // Troca de modo Preço vs Margem
  if (elements.modeMarginBtn && elements.modePriceBtn) {
    elements.modeMarginBtn.addEventListener('click', () => {
      state.calcMode = 'margin';
      elements.modeMarginBtn.classList.add('active');
      elements.modePriceBtn.classList.remove('active');
      if (elements.priceInputGroup) elements.priceInputGroup.style.display = 'none';
      if (elements.marginInputGroup) elements.marginInputGroup.style.display = 'block';
      updateCalculations();
    });

    elements.modePriceBtn.addEventListener('click', () => {
      state.calcMode = 'price';
      elements.modePriceBtn.classList.add('active');
      elements.modeMarginBtn.classList.remove('active');
      if (elements.priceInputGroup) elements.priceInputGroup.style.display = 'block';
      if (elements.marginInputGroup) elements.marginInputGroup.style.display = 'none';
      updateCalculations();
    });
  }

  // Atalhos de Margem (30%, 40%, 50%, 60%)
  if (elements.marginPills) {
    elements.marginPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const val = parseFloat(e.currentTarget.getAttribute('data-margin'));
        if (elements.targetMarginInput) elements.targetMarginInput.value = val;
        state.targetMargin = val;
        if (state.calcMode !== 'margin' && elements.modeMarginBtn) {
          elements.modeMarginBtn.click();
        } else {
          updateCalculations();
        }
      });
    });
  }

  // Atalhos de Preço de Venda (R$ 24,90, etc.)
  if (elements.pricePills) {
    elements.pricePills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const val = parseFloat(e.currentTarget.getAttribute('data-price'));
        if (elements.salePriceInput) elements.salePriceInput.value = val.toFixed(2);
        state.salePrice = val;
        if (state.calcMode !== 'price' && elements.modePriceBtn) {
          elements.modePriceBtn.click();
        } else {
          updateCalculations();
        }
      });
    });
  }

  // Botões de 1 clique para Bom Preço e Preço Ideal
  if (elements.btnUseGoodPrice) {
    elements.btnUseGoodPrice.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentRecs = engine.computeSmartRecommendations(state, state.quantity, state.batchPackagingType);
      if (currentRecs.goodPrice && currentRecs.goodPrice.price > 0) {
        state.salePrice = currentRecs.goodPrice.price;
        if (elements.salePriceInput) elements.salePriceInput.value = currentRecs.goodPrice.price.toFixed(2);
        if (state.calcMode === 'margin' && elements.modePriceBtn) {
          elements.modePriceBtn.click();
        } else {
          updateCalculations();
        }
        showToast(`Bom Preço aplicado: R$ ${currentRecs.goodPrice.price.toFixed(2).replace('.', ',')}`, '🟢');
      }
    });
  }

  if (elements.cardGoodPrice) {
    elements.cardGoodPrice.addEventListener('click', (e) => {
      if (e.target !== elements.btnUseGoodPrice) {
        elements.btnUseGoodPrice?.click();
      }
    });
  }

  if (elements.btnUseIdealPrice) {
    elements.btnUseIdealPrice.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentRecs = engine.computeSmartRecommendations(state, state.quantity, state.batchPackagingType);
      if (currentRecs.idealPrice && currentRecs.idealPrice.price > 0) {
        state.salePrice = currentRecs.idealPrice.price;
        if (elements.salePriceInput) elements.salePriceInput.value = currentRecs.idealPrice.price.toFixed(2);
        if (state.calcMode === 'margin' && elements.modePriceBtn) {
          elements.modePriceBtn.click();
        } else {
          updateCalculations();
        }
        showToast(`Preço Ideal aplicado: R$ ${currentRecs.idealPrice.price.toFixed(2).replace('.', ',')}`, '🌟');
      }
    });
  }

  if (elements.cardIdealPrice) {
    elements.cardIdealPrice.addEventListener('click', (e) => {
      if (e.target !== elements.btnUseIdealPrice) {
        elements.btnUseIdealPrice?.click();
      }
    });
  }

  // Quick pills do Modo Kit / Lote
  if (elements.batchPills) {
    elements.batchPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const qty = parseInt(e.currentTarget.getAttribute('data-qty'), 10);
        if (elements.batchQtyInput) elements.batchQtyInput.value = qty;
        state.quantity = qty;
        elements.batchPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Se estávamos com Bom Preço ou Preço Ideal ativo, recalcula o preço para o kit
        if (hasActiveSpecs(state) && state.calcMode === 'price') {
          const newRecs = engine.computeSmartRecommendations(state, qty, state.batchPackagingType);
          if (elements.cardGoodPrice && elements.cardGoodPrice.classList.contains('active')) {
            state.salePrice = newRecs.goodPrice.price;
            if (elements.salePriceInput) elements.salePriceInput.value = newRecs.goodPrice.price.toFixed(2);
          } else if (elements.cardIdealPrice && (elements.cardIdealPrice.classList.contains('active') || state.salePrice <= 0)) {
            state.salePrice = newRecs.idealPrice.price;
            if (elements.salePriceInput) elements.salePriceInput.value = newRecs.idealPrice.price.toFixed(2);
          }
        }

        updateCalculations();
      });
    });
  }

  // Troca de perfil de impressora
  if (elements.printerSelect) {
    elements.printerSelect.addEventListener('change', (e) => {
      const selected = PRINTER_PROFILES.find(p => p.id === e.target.value);
      state.printerId = e.target.value;
      if (selected) {
        state.printerWatts = selected.watts;
        if (elements.printerWattsInput) elements.printerWattsInput.value = selected.watts;
        if (elements.wattsRow) elements.wattsRow.style.display = selected.id === 'custom' ? 'block' : 'none';
      }
      updateCalculations();
    });
  }

  // Troca de tipo de filamento
  if (elements.filamentSelect) {
    elements.filamentSelect.addEventListener('change', (e) => {
      const selected = FILAMENT_PROFILES.find(f => f.id === e.target.value);
      state.filamentType = e.target.value;
      if (selected && elements.filamentPriceInput) {
        elements.filamentPriceInput.value = selected.defaultPrice.toFixed(2);
        state.filamentPriceKg = selected.defaultPrice;
      }
      updateCalculations();
    });
  }

  // Collapsible cards toggle (Ajustes de Oficina)
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
      const target = elements.pricingHeroResult || elements.matrixBody;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    elements.batchQtyInput
  ].filter(Boolean);

  liveInputs.forEach(input => {
    input.addEventListener('input', () => updateCalculations());
    input.addEventListener('change', () => updateCalculations());
  });

  // Botões de Limpar / Zerar
  if (elements.resetCalcBtn) {
    elements.resetCalcBtn.addEventListener('click', resetCalculation);
  }
  if (elements.quickResetBtn) {
    elements.quickResetBtn.addEventListener('click', resetCalculation);
  }

  // Modais de Histórico & Preferências
  if (elements.saveCalcBtn) elements.saveCalcBtn.addEventListener('click', saveCalculation);
  if (elements.copySummaryBtn) elements.copySummaryBtn.addEventListener('click', copySummaryToClipboard);

  if (elements.historyBtn && elements.historyModal) {
    elements.historyBtn.addEventListener('click', () => {
      renderHistory();
      elements.historyModal.classList.add('active');
    });
  }

  if (elements.closeHistoryBtn && elements.historyModal) {
    elements.closeHistoryBtn.addEventListener('click', () => {
      elements.historyModal.classList.remove('active');
    });
  }

  if (elements.prefsBtn && elements.prefsModal) {
    elements.prefsBtn.addEventListener('click', () => {
      elements.prefsModal.classList.add('active');
    });
  }

  if (elements.closePrefsBtn && elements.prefsModal) {
    elements.closePrefsBtn.addEventListener('click', () => {
      elements.prefsModal.classList.remove('active');
    });
  }

  if (elements.savePrefsBtn && elements.prefsModal) {
    elements.savePrefsBtn.addEventListener('click', () => {
      const newPrefs = {
        defaultPrinterId: elements.prefPrinterSelect ? elements.prefPrinterSelect.value : 'bambu-p1s',
        defaultKwhCost: parseFloat(elements.prefKwhInput?.value) || 0.85,
        defaultTaxPercent: parseFloat(elements.prefTaxInput?.value) || 6.0,
        defaultPackagingCost: parseFloat(elements.prefPackagingInput?.value) || 1.50
      };
      engine.savePreferences(newPrefs);
      elements.prefsModal.classList.remove('active');
      showToast('Preferências salvas!', '⚙️');
      initializeSelectors();
      updateCalculations();
    });
  }

  // Fechar modais ao clicar fora
  window.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) elements.historyModal.classList.remove('active');
    if (e.target === elements.prefsModal) elements.prefsModal.classList.remove('active');
  });
}

// Inicialização da Aplicação
window.addEventListener('DOMContentLoaded', () => {
  initializeSelectors();
  setupEventListeners();
  updateCalculations();
});

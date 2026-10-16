import { PRINTER_PROFILES, FILAMENT_PROFILES, MARKETPLACE_CONFIG } from './presets.js';

export class PricingEngine {
  constructor() {
    this.preferences = this.loadPreferences();
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem('precificadora3d_preferences');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Erro ao carregar preferências:', e);
    }
    return {
      defaultPrinterId: 'bambu-p1s',
      defaultFilamentId: 'pla',
      defaultFilamentPrice: 80.0,
      defaultKwhCost: 0.85,
      defaultTaxPercent: 6.0,
      defaultPackagingCost: 2.38,
      defaultMachineHourCost: 0.0,
      defaultDailyHours: 20
    };
  }

  savePreferences(prefs) {
    this.preferences = { ...this.preferences, ...prefs };
    try {
      localStorage.setItem('precificadora3d_preferences', JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Erro ao salvar preferências:', e);
    }
  }

  formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatPercent(value) {
    return (Number(value || 0)).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + '%';
  }

  /**
   * Calcula todos os custos associados a um determinado preço de venda
   */
  computeCostsForPrice(price, inputs) {
    const {
      marketplaceKey,
      weightGrams = 85,
      filamentPriceKg = 80,
      printHours = 2,
      printMinutes = 30,
      printerWatts = 120,
      costPerKwh = 0.85,
      packagingCost = 2.38,
      machineHourCost = 0.0,
      extraInsumosCost = 0.0,
      taxPercent = 6.0,
      isCpfShopee = false,
      lossMarginPercent = 0.0,
      customShipping = null,
      paymentMethodDirect = 'pix',
      cardFeePercentDirect = 3.5
    } = inputs;

    const totalHours = Math.max(0.01, Number(printHours) + Number(printMinutes) / 60);

    // 1. Custo do filamento (incluindo margem de perda se houver)
    const rawFilamentCost = (Number(weightGrams) / 1000) * Number(filamentPriceKg);
    const lossMultiplier = 1 + (Number(lossMarginPercent) / 100);
    const filamentCost = rawFilamentCost * lossMultiplier;

    // 2. Custo de energia elétrica
    // Consumo kWh = (Watts * horas) / 1000
    // Em certas impressoras, o aquecimento inicial consome mais, ajustado linearmente pelo perfil
    const kwhConsumed = (Number(printerWatts) / 1000) * totalHours;
    let electricityCost = kwhConsumed * Number(costPerKwh);
    // Garantir valor mínimo razoável para exibições realistas
    if (electricityCost < 0.05 && totalHours >= 1) electricityCost = 0.05;

    // 3. Custo de embalagem e insumos extras
    const packCost = Number(packagingCost) || 0;
    const insumosCost = Number(extraInsumosCost) || 0;

    // 4. Depreciação / Manutenção de máquina por hora
    const depreciationCost = totalHours * (Number(machineHourCost) || 0);

    // 5. Custo direto de fabricação (independe do preço de venda)
    const directProductionCost = filamentCost + electricityCost + packCost + insumosCost + depreciationCost;

    // 6. Impostos sobre faturamento
    const taxesCost = price * (Number(taxPercent) / 100);

    // 7. Marketplace Fee & Frete
    let marketplaceFee = 0;
    let shippingCost = 0;
    let marketplaceDetailName = '';

    const mp = MARKETPLACE_CONFIG[marketplaceKey] || MARKETPLACE_CONFIG.ml_premium;

    if (marketplaceKey === 'ml_premium' || marketplaceKey === 'ml_classico') {
      const commRate = mp.commissionPercent / 100;
      marketplaceFee = price * commRate;
      marketplaceDetailName = `Taxa ${mp.subTag} (${mp.commissionPercent}%)`;

      if (customShipping !== null && customShipping !== undefined && customShipping !== '') {
        shippingCost = Number(customShipping);
      } else {
        if (price < mp.freeShippingThreshold) {
          // Abaixo de R$ 79: Taxa fixa unitária
          shippingCost = mp.fixedFeeUnderThreshold;
        } else {
          // Acima de R$ 79: Frete grátis obrigatório subsidiado pago pelo vendedor
          const weight = Number(weightGrams);
          const rateObj = mp.shippingRatesByWeight.find(r => weight <= r.maxGrams) ||
            mp.shippingRatesByWeight[mp.shippingRatesByWeight.length - 1];
          shippingCost = rateObj.cost;
        }
      }
    } else if (marketplaceKey === 'shopee_fge' || marketplaceKey === 'shopee_padrao') {
      const commRate = mp.commissionPercent / 100;
      const rawComm = price * commRate;
      const commission = Math.min(rawComm, mp.commissionCap);
      const fixed = mp.fixedFee + (isCpfShopee ? mp.cpfExtraFee : 0);
      marketplaceFee = commission + fixed;
      marketplaceDetailName = `Taxa Shopee (${mp.commissionPercent}% + R$ ${fixed.toFixed(2)})`;

      if (customShipping !== null && customShipping !== undefined && customShipping !== '') {
        shippingCost = Number(customShipping);
      } else {
        shippingCost = mp.estimatedShipping || 0;
      }
    } else if (marketplaceKey === 'venda_direta') {
      if (paymentMethodDirect === 'card') {
        marketplaceFee = price * (Number(cardFeePercentDirect) / 100);
        marketplaceDetailName = `Taxa Cartão (${cardFeePercentDirect}%)`;
      } else {
        marketplaceFee = 0;
        marketplaceDetailName = 'Taxa Pix (0%)';
      }
      shippingCost = customShipping ? Number(customShipping) : 0;
    }

    const totalDeductions = marketplaceFee + shippingCost + taxesCost + directProductionCost;
    const netProfit = price - totalDeductions;
    const netMarginPercent = price > 0 ? (netProfit / price) * 100 : 0;

    return {
      price,
      totalHours,
      filamentCost,
      electricityCost,
      packagingCost: packCost,
      insumosCost,
      depreciationCost,
      directProductionCost,
      taxesCost,
      marketplaceFee,
      marketplaceDetailName,
      shippingCost,
      totalDeductions,
      netProfit,
      netMarginPercent
    };
  }

  /**
   * Encontra o Preço de Venda ideal para atingir a Margem Desejada
   * Utiliza busca binária iterativa com precisão de centavos
   */
  findPriceForTargetMargin(targetMargin, inputs) {
    const targetM = Number(targetMargin);
    if (targetM >= 95) return 999.0;

    let low = 1.0;
    let high = 5000.0;
    let bestPrice = low;

    for (let iter = 0; iter < 40; iter++) {
      const mid = (low + high) / 2;
      const result = this.computeCostsForPrice(mid, inputs);

      if (result.netMarginPercent < targetM) {
        low = mid;
      } else {
        bestPrice = mid;
        high = mid;
      }
    }

    return Math.round(bestPrice * 100) / 100;
  }

  /**
   * Arredonda para preço comercial atraente (.90) garantindo a margem
   */
  roundCommercialPrice(val) {
    if (!val || val <= 0) return 0;
    const floorVal = Math.floor(val);
    const cand = floorVal + 0.90;
    return cand >= val ? cand : floorVal + 1.90;
  }

  /**
   * Calcula o detalhamento da Equação de Custo de Produção (Unitário e Multiplicado por Kit)
   */
  computeProductionEquation(inputs, quantity = 1, batchPackaging = 'single') {
    const q = Math.max(1, parseInt(quantity, 10) || 1);
    const weight = Number(inputs.weightGrams) || 0;
    const filamentPriceKg = Number(inputs.filamentPriceKg) || 80;
    const lossMultiplier = 1 + ((Number(inputs.lossMarginPercent) || 0) / 100);

    const unitHours = Math.max(0, (Number(inputs.printHours) || 0) + (Number(inputs.printMinutes) || 0) / 60);
    const printerWatts = Number(inputs.printerWatts) || 120;
    const costPerKwh = Number(inputs.costPerKwh) || 0.85;

    // Custos Unitários
    const unitFilamentCost = (weight / 1000) * filamentPriceKg * lossMultiplier;
    const unitElectricityCost = (printerWatts / 1000) * unitHours * costPerKwh;
    const unitPackagingCost = Number(inputs.packagingCost) || 0;
    const unitInsumosCost = Number(inputs.extraInsumosCost) || 0;
    const unitDepreciationCost = unitHours * (Number(inputs.machineHourCost) || 0);
    const unitProductionCost = unitFilamentCost + unitElectricityCost + unitPackagingCost + unitInsumosCost + unitDepreciationCost;

    // Multiplicação da Equação para o Kit
    const totalWeightGrams = weight * q;
    const totalPrintHours = unitHours * q;
    const totalFilamentCost = unitFilamentCost * q;
    const totalElectricityCost = unitElectricityCost * q;
    const totalInsumosCost = unitInsumosCost * q;
    const totalDepreciationCost = unitDepreciationCost * q;

    // Embalagem do kit: se caixa única, cobra uma embalagem com leve margem para volume; se individual, cobra N vezes
    const effectivePackagingCost = batchPackaging === 'single'
      ? (q === 1 ? unitPackagingCost : Math.round((unitPackagingCost * 1.35) * 100) / 100)
      : unitPackagingCost * q;

    const totalProductionCost = totalFilamentCost + totalElectricityCost + effectivePackagingCost + totalInsumosCost + totalDepreciationCost;

    return {
      quantity: q,
      unitWeightGrams: weight,
      totalWeightGrams,
      unitPrintHours: unitHours,
      totalPrintHours,
      unitFilamentCost,
      totalFilamentCost,
      unitElectricityCost,
      totalElectricityCost,
      unitPackagingCost,
      effectivePackagingCost,
      unitInsumosCost,
      totalInsumosCost,
      unitDepreciationCost,
      totalDepreciationCost,
      unitProductionCost,
      totalProductionCost
    };
  }

  /**
   * Calcula as duas recomendações de preço ("Bom Preço" e "Preço Ideal") para venda na internet
   */
  computeSmartRecommendations(inputs, quantity = 1, batchPackaging = 'single') {
    const q = Math.max(1, parseInt(quantity, 10) || 1);
    const prod = this.computeProductionEquation(inputs, q, batchPackaging);

    if (prod.totalWeightGrams <= 0 && prod.totalPrintHours <= 0) {
      return {
        production: prod,
        goodPrice: { price: 0, netProfit: 0, netMarginPercent: 0, unitProfit: 0, targetMargin: 38 },
        idealPrice: { price: 0, netProfit: 0, netMarginPercent: 0, unitProfit: 0, targetMargin: 52 }
      };
    }

    const kitInputs = {
      ...inputs,
      weightGrams: prod.totalWeightGrams,
      printHours: Math.floor(prod.totalPrintHours),
      printMinutes: Math.round((prod.totalPrintHours % 1) * 60),
      packagingCost: prod.effectivePackagingCost,
      extraInsumosCost: prod.totalInsumosCost,
      machineHourCost: inputs.machineHourCost
    };

    // 1. Bom Preço para Internet (Giro Rápido / Competitivo): ~38% de margem líquida
    const rawGood = this.findPriceForTargetMargin(38, kitInputs);
    const goodPrice = this.roundCommercialPrice(rawGood);
    const resultGood = this.computeCostsForPrice(goodPrice, kitInputs);

    // 2. Preço Ideal (Margem Máxima Recomendada 3D): ~52% de margem líquida
    const rawIdeal = this.findPriceForTargetMargin(52, kitInputs);
    const idealPrice = this.roundCommercialPrice(rawIdeal);
    const resultIdeal = this.computeCostsForPrice(idealPrice, kitInputs);

    return {
      production: prod,
      goodPrice: {
        price: goodPrice,
        netProfit: resultGood.netProfit,
        netMarginPercent: resultGood.netMarginPercent,
        unitProfit: resultGood.netProfit / q,
        targetMargin: 38
      },
      idealPrice: {
        price: idealPrice,
        netProfit: resultIdeal.netProfit,
        netMarginPercent: resultIdeal.netMarginPercent,
        unitProfit: resultIdeal.netProfit / q,
        targetMargin: 52
      }
    };
  }

  /**
   * Cálculo de Promoção com Lucro Preservado
   * Preço a anunciar = Preço normal / (1 - desconto)
   */
  calculatePromotion(effectivePrice, discountPercent) {
    const discount = Number(discountPercent) / 100;
    if (discount <= 0 || discount >= 0.99) {
      return {
        announcedPrice: effectivePrice,
        customerPays: effectivePrice,
        discountPercent: 0,
        discountValue: 0
      };
    }

    const announcedPrice = effectivePrice / (1 - discount);
    const discountValue = announcedPrice - effectivePrice;

    return {
      announcedPrice: Math.round(announcedPrice * 100) / 100,
      customerPays: effectivePrice,
      discountPercent: Number(discountPercent),
      discountValue: Math.round(discountValue * 100) / 100
    };
  }

  /**
   * Avalia a saúde da margem de lucro
   */
  getMarginClassification(marginPercent) {
    if (marginPercent >= 45) {
      return { label: 'Excelente', level: 'excellent', color: '#00e5a0', bg: 'rgba(0, 229, 160, 0.15)' };
    } else if (marginPercent >= 25) {
      return { label: 'Saudável', level: 'good', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    } else if (marginPercent >= 10) {
      return { label: 'Atenção (Baixa)', level: 'warning', color: '#ffb020', bg: 'rgba(255, 176, 32, 0.15)' };
    } else if (marginPercent > 0) {
      return { label: 'Crítica', level: 'critical', color: '#ff3f5e', bg: 'rgba(255, 63, 94, 0.15)' };
    } else {
      return { label: 'Prejuízo', level: 'danger', color: '#ff3f5e', bg: 'rgba(255, 63, 94, 0.25)' };
    }
  }

  /**
   * Projeção de Capacidade Produtiva
   */
  calculateProductionCapacity(netProfit, salePrice, printHoursTotal, dailyWorkingHours = 20) {
    const hours = Math.max(0.1, printHoursTotal);
    const dailyHours = Math.max(1, Math.min(24, Number(dailyWorkingHours)));

    const profitPerHour = netProfit / hours;
    const piecesPerDay = dailyHours / hours;
    const dailyProfit = profitPerHour * dailyHours;
    const dailyRevenue = piecesPerDay * salePrice;

    const monthlyProfit = dailyProfit * 30;
    const monthlyRevenue = dailyRevenue * 30;
    const piecesPerMonth = piecesPerDay * 30;

    return {
      profitPerHour,
      dailyHours,
      piecesPerDay: Math.floor(piecesPerDay * 10) / 10,
      dailyProfit,
      dailyRevenue,
      piecesPerMonth: Math.round(piecesPerMonth),
      monthlyProfit,
      monthlyRevenue
    };
  }

  /**
   * Projeção de Produção em Lote / Pedido de Atacado
   */
  computeBatchMetrics(unitPrice, quantity, inputs, batchPackaging = 'single', batchDiscountPercent = 0) {
    const q = Math.max(1, parseInt(quantity, 10) || 1);
    const discountRate = Math.max(0, Math.min(80, Number(batchDiscountPercent) || 0)) / 100;
    
    // Preço unitário com desconto comercial
    const discountedUnitPrice = unitPrice * (1 - discountRate);
    const totalBatchPrice = discountedUnitPrice * q;

    // Ajusta parâmetros de produção para o lote inteiro
    const totalGrams = (Number(inputs.weightGrams) || 0) * q;
    const totalFilamentKg = totalGrams / 1000;
    const spoolsEstimated = Math.max(1, Math.ceil(totalFilamentKg));

    const unitHours = Math.max(0.01, (Number(inputs.printHours) || 0) + (Number(inputs.printMinutes) || 0) / 60);
    const totalBatchHours = unitHours * q;

    // Embalagem do lote: se 'single', cobra 1x embalagem (ou leve acréscimo para caixa maior)
    // Se 'individual', cada peça tem sua embalagem individual
    const singlePackCost = Number(inputs.packagingCost) || 0;
    const effectivePackagingCost = batchPackaging === 'single'
      ? (q === 1 ? singlePackCost : singlePackCost * 1.5)
      : singlePackCost * q;

    // Executa o cálculo considerando o lote como um pedido único
    const batchInputs = {
      ...inputs,
      weightGrams: totalGrams,
      printHours: Math.floor(totalBatchHours),
      printMinutes: Math.round((totalBatchHours % 1) * 60),
      packagingCost: effectivePackagingCost,
      extraInsumosCost: (Number(inputs.extraInsumosCost) || 0) * q,
      machineHourCost: inputs.machineHourCost
    };

    const batchResult = this.computeCostsForPrice(totalBatchPrice, batchInputs);
    const unitNetProfit = batchResult.netProfit / q;

    return {
      quantity: q,
      batchDiscountPercent,
      discountedUnitPrice,
      totalBatchPrice,
      totalGrams,
      totalFilamentKg: Math.round(totalFilamentKg * 100) / 100,
      spoolsEstimated,
      totalBatchHours: Math.round(totalBatchHours * 10) / 10,
      totalPrintDays: Math.round((totalBatchHours / (Number(inputs.dailyWorkingHours) || 20)) * 10) / 10,
      batchNetProfit: batchResult.netProfit,
      batchNetMarginPercent: batchResult.netMarginPercent,
      unitNetProfit,
      batchDeductions: batchResult.totalDeductions,
      batchMarketplaceFee: batchResult.marketplaceFee,
      batchShippingCost: batchResult.shippingCost,
      batchTaxesCost: batchResult.taxesCost,
      batchProductionCost: batchResult.directProductionCost
    };
  }
}

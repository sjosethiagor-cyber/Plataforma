// Presets e configurações oficiais 2026 para a Precificadora 3D Ecom
export const PRINTER_PROFILES = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 Mini', watts: 80, kw: 0.08, category: 'bambu', desc: 'Leve e eficiente (~80W)' },
  { id: 'bambu-a1', name: 'Bambu Lab A1', watts: 110, kw: 0.11, category: 'bambu', desc: 'Média de 110W' },
  { id: 'bambu-p1p', name: 'Bambu Lab P1P', watts: 110, kw: 0.11, category: 'bambu', desc: 'Média de 110W' },
  { id: 'bambu-p1s', name: 'Bambu Lab P1S', watts: 120, kw: 0.12, category: 'bambu', desc: 'Fechada · Média de 120W' },
  { id: 'bambu-x1c', name: 'Bambu Lab X1 Carbon', watts: 130, kw: 0.13, category: 'bambu', desc: 'Gabinete aquecido (~130W)' },
  { id: 'bambu-h2d', name: 'Bambu Lab H2D', watts: 150, kw: 0.15, category: 'bambu', desc: 'Alta performance (~150W)' },
  { id: 'creality-ender3', name: 'Creality Ender 3 / V2 / V3', watts: 120, kw: 0.12, category: 'creality', desc: 'Mesa aquecida (~120W)' },
  { id: 'creality-k1', name: 'Creality K1 / K1 Max', watts: 140, kw: 0.14, category: 'creality', desc: 'CoreXY fechada (~140W)' },
  { id: 'neptune-4', name: 'Elegoo Neptune 4 / Pro', watts: 130, kw: 0.13, category: 'elegoo', desc: 'Alta velocidade (~130W)' },
  { id: 'resin-printer', name: 'Impressora de Resina (LCD 4K/8K)', watts: 65, kw: 0.065, category: 'resina', desc: 'UV LED (~65W)' },
  { id: 'custom', name: 'Personalizada (Definir Watts)', watts: 100, kw: 0.10, category: 'custom', desc: 'Defina o consumo manual' }
];

export const FILAMENT_PROFILES = [
  { id: 'pla', name: 'PLA Standard', defaultPrice: 80.00, density: 1.24 },
  { id: 'pla-silk', name: 'PLA Silk / Bicolor', defaultPrice: 110.00, density: 1.24 },
  { id: 'petg', name: 'PETG', defaultPrice: 85.00, density: 1.27 },
  { id: 'abs', name: 'ABS / ASA', defaultPrice: 90.00, density: 1.05 },
  { id: 'tpu', name: 'TPU / Flexível', defaultPrice: 135.00, density: 1.21 },
  { id: 'resina', name: 'Resina UV Standard (1L/kg)', defaultPrice: 120.00, density: 1.10 }
];

export const MARKETPLACE_CONFIG = {
  ml_premium: {
    id: 'ml_premium',
    name: 'Mercado Livre Premium',
    badge: '19% + Fixo/Frete',
    tag: 'ML',
    subTag: 'Premium',
    color: '#ffe600',
    commissionPercent: 19.0,
    freeShippingThreshold: 79.0,
    fixedFeeUnderThreshold: 6.50,
    shippingRatesByWeight: [
      { maxGrams: 300, cost: 5.50 },
      { maxGrams: 500, cost: 6.50 },
      { maxGrams: 1000, cost: 9.80 },
      { maxGrams: 2000, cost: 13.50 },
      { maxGrams: 5000, cost: 18.00 }
    ],
    info: '19% de comissão. Produtos abaixo de R$ 79 têm taxa fixa de R$ 6,50. Acima de R$ 79 têm frete grátis obrigatório copago pelo vendedor.'
  },
  ml_classico: {
    id: 'ml_classico',
    name: 'Mercado Livre Clássico',
    badge: '14% + Fixo/Frete',
    tag: 'ML',
    subTag: 'Clássico',
    color: '#ffe600',
    commissionPercent: 14.0,
    freeShippingThreshold: 79.0,
    fixedFeeUnderThreshold: 6.50,
    shippingRatesByWeight: [
      { maxGrams: 300, cost: 5.50 },
      { maxGrams: 500, cost: 6.50 },
      { maxGrams: 1000, cost: 9.80 },
      { maxGrams: 2000, cost: 13.50 },
      { maxGrams: 5000, cost: 18.00 }
    ],
    info: '14% de comissão média. Taxa fixa de R$ 6,50 abaixo de R$ 79, e frete copago acima de R$ 79.'
  },
  shopee_fge: {
    id: 'shopee_fge',
    name: 'Shopee (Frete Grátis Extra 2026)',
    badge: '20% + R$ 4,00',
    tag: 'Shopee',
    subTag: 'FGE 2026',
    color: '#ff5722',
    commissionPercent: 20.0, // 14% padrão + 6% FGE
    commissionCap: 103.00,   // teto de comissão por item
    fixedFee: 4.00,
    cpfExtraFee: 5.00,
    estimatedShipping: 5.00,
    info: 'Taxas 2026: 14% comissão + 6% Frete Grátis Extra (teto de R$ 103 por item) + R$ 4,00 por item vendido.'
  },
  shopee_padrao: {
    id: 'shopee_padrao',
    name: 'Shopee (Padrão sem FGE)',
    badge: '14% + R$ 4,00',
    tag: 'Shopee',
    subTag: 'Padrão',
    color: '#ff5722',
    commissionPercent: 14.0,
    commissionCap: 103.00,
    fixedFee: 4.00,
    cpfExtraFee: 5.00,
    estimatedShipping: 0.00,
    info: 'Taxas 2026: 14% de comissão (teto de R$ 103 por item) + R$ 4,00 por item vendido.'
  },
  venda_direta: {
    id: 'venda_direta',
    name: 'Venda Direta / WhatsApp / Site',
    badge: 'Sem Taxa de Marketplace',
    tag: 'Direta',
    subTag: 'Pix/Cartão',
    color: '#00e5a0',
    commissionPercent: 0.0,
    cardFeePercent: 3.5,
    fixedFee: 0.0,
    estimatedShipping: 0.0,
    info: 'Sem comissões de terceiros. Apenas taxa do meio de pagamento (0% no Pix ou taxa de cartão).'
  }
};

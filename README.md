# ⚡ Plataforma3D — Calculadora de Precificação para Impressão 3D (Taxas 2026)

Calculadora moderna, profissional e completa para precificação de peças impressas em 3D. Calcula custos reais de energia, filamento, depreciação, embalagem e aplica automaticamente as taxas reais de **Shopee (FGE / Padrão 2026)** e **Mercado Livre (Premium / Clássico 2026)** com lucro líquido real garantido.

---

## ✨ Funcionalidades Principais

* **Taxas de Marketplaces 2026 Atualizadas:**
  * **Shopee:** Programa de Frete Grátis Extra (FGE) com taxa de 14% + 6% (com teto de comissão de R$ 103 por item) + taxa fixa de R$ 4,00 por item vendido (com seletor opcional para taxa de vendedor CPF de +R$ 5,00).
  * **Mercado Livre:** Modalidades Premium (19%) e Clássico (14%) com taxa fixa para itens abaixo de R$ 79,00, tabela oficial de frete por faixa de peso e campo opcional para frete customizado/subsídio.
  * **TikTok Shop:** Taxa de 14% + taxa fixa de R$ 4,00 por item.
  * **Venda Direta / Balcão:** Cálculo para Pix/Dinheiro (0% taxa) e Cartão à vista com taxa de maquininha personalizável.
* **Extrator Automático de G-Code & .3MF:**
  * Arraste arquivos fatiados (`.gcode`, `.3mf`, `.gcode.3mf`) do **Bambu Studio**, **OrcaSlicer**, **UltiMaker Cura**, **PrusaSlicer** ou **Creality Print**.
  * Extração instantânea de tempo de impressão (horas e minutos), consumo de filamento (gramas com soma de AMS multi-cores) e tipo de material.
  * Estimativa geométrica preliminar para modelos 3D brutos (`.stl` e `.3mf`).
* **Formação de Kits & Lotes com Escala:**
  * Multiplicação automática de toda a equação de custo (1 a 10 unidades ou manual) com ganho de escala inteligente em embalagens de caixa única.
* **Painel de Detalhamento em Cascata Financeira (Waterfall):**
  * Demonstrativo em cascata (`└─`) com saldo remanescente linha por linha (`= R$ ...`), percentuais sobre o preço de venda e totalizadores de custos com destaque para Energia + Filamento.
  * Caixa de Lucro Líquido com taxa horária (`R$/hora`), indicador de saúde da margem (Excelente, Boa, Atenção, etc.), projeção de capacidade produtiva diária e mensal, detalhamento de taxas específicas do canal e botão para salvar o cálculo direto no card.
* **Recomendações Prontas de Preço (1 Clique):**
  * **🟢 Bom Preço:** Margem de ~38% para giro rápido e alta conversão.
  * **🌟 Preço Ideal 3D:** Margem recomendada de ~52% para peças 3D de alta lucratividade.
* **Gráfico Donut Interativo de Composição de Custos (Raio-X):**
  * Visualização gráfica em SVG mostrando exatamente a fatia de Lucro Líquido, Marketplace, Frete, Impostos, Filamento, Energia e Embalagem/Bico.
* **Simulador de Promoção com Lucro Preservado:**
  * Calcule por quanto anunciar (Preço "De") para oferecer 5%, 10%, 15% ou 20% de desconto em campanhas ou cupons mantendo 100% do seu lucro líquido garantido no bolso.
* **Comparativo Multicanal Simultâneo:**
  * Tabela em tempo real comparando lado a lado quanto sobra no seu bolso vendendo pelo mesmo preço no Mercado Livre, Shopee, TikTok Shop e Venda Direta.
* **Interface Moderna e Responsiva:**
  * Design dark SaaS com tipografia legível (**Plus Jakarta Sans** com numerais tabulares).
  * Barra fixa no rodapé mobile para acompanhamento ágil de margem e lucro na bancada.
  * Histórico local de orçamentos e peças salvas (salvo no navegador via `localStorage`).
  * Exportação de resumo formatado pronto para WhatsApp.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js (versão 18 ou superior)

### Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/precificadora3d.git

# 2. Acesse a pasta do projeto
cd precificadora3d

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse em seu navegador no endereço: [http://localhost:5173](http://localhost:5173)

---

## 📂 Estrutura do Projeto

```text
precificadora3d/
├── index.html           # Estrutura HTML semântica da aplicação
├── style.css            # Design system, temas, responsividade e animações
├── app.js               # Orquestração da interface, eventos e histórico
├── calculator.js        # Motor matemático financeiro e taxas de marketplaces
├── gcodeParser.js       # Extrator client-side de metadados G-Code e .3MF
├── presets.js           # Perfis de impressoras e filamentos pré-configurados
├── package.json         # Dependências e scripts Vite
└── README.md            # Documentação do projeto
```

---

## 📄 Licença

Distribuído sob a licença MIT. Sinta-se livre para utilizar, modificar e aprimorar para seu negócio de impressão 3D!

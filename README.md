# ⚡ Plataforma3D — Calculadora de Precificação para Impressão 3D (Taxas 2026)

Calculadora moderna, profissional e completa para precificação de peças impressas em 3D. Calcula custos reais de energia, filamento, depreciação, embalagem e aplica automaticamente as taxas reais de **Shopee (FGE / Padrão 2026)** e **Mercado Livre (Premium / Clássico 2026)** com lucro líquido real garantido.

---

## ✨ Funcionalidades Principais

* **Taxas de Marketplaces 2026 Atualizadas:**
  * **Shopee:** Programa de Frete Grátis Extra (FGE) com taxa padrão de 14% + 6% (com teto de comissão por item) + taxa fixa de R$ 4,00 por item vendido (adicional de R$ 3,00 para vendedores CPF).
  * **Mercado Livre:** Modalidades Premium e Clássico com custo fixo para itens abaixo de R$ 79,00 e tabela oficial de frete por faixa de peso.
  * **Venda Direta:** Cálculo para Pix, cartão ou WhatsApp sem intermediários.
* **Extrator Automático de G-Code & .3MF:**
  * Arraste arquivos fatiados (`.gcode`, `.3mf`, `.gcode.3mf`) do **Bambu Studio**, **OrcaSlicer**, **UltiMaker Cura**, **PrusaSlicer** ou **Creality Print**.
  * Extração instantânea de tempo de impressão (horas e minutos), consumo de filamento (gramas com soma de AMS multi-cores) e tipo de material.
  * Estimativa geométrica preliminar para modelos 3D brutos (`.stl` e `.3mf`).
* **Modo Lote / Atacado:**
  * Cálculo de faturamento total, lucro acumulado do lote, desconto progressivo, total de quilos de filamento e carretéis estimados.
* **Gráfico Donut Interativo de Composição de Custos:**
  * Visualização gráfica em SVG mostrando exatamente a fatia de Marketplace, Frete, Impostos, Filamento, Energia, Embalagem e Lucro Líquido.
* **Interface Moderna e Responsiva:**
  * Design dark SaaS com tipografia legível (**Plus Jakarta Sans** com numerais tabulares).
  * Barra fixa no rodapé mobile para acompanhamento ágil de margem e lucro.
  * Histórico local de orçamentos e peças salvas (salvo no navegador via `localStorage`).

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

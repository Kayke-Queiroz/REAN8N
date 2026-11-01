# Documentação de Arquitetura, Stack e Guia de Contexto para LLMs (`n8n-reconstructed`)

> **Propósito deste Documento (LLM Handover / Context Guide)**:
> Este documento foi estruturado especificamente para que **qualquer LLM / Agente de IA ou Desenvolvedor** que assuma a manutenção ou evolução deste projeto compreenda imediatamente:
> 1. O processo de Engenharia Reversa estática executado sobre o **n8n v1.118.1** via **REA (`reverse-engineer-anything`)**.
> 2. A **Stack Tecnológica** completa (Frontend, Engine de Grafo/Execução e Backend).
> 3. A **Arquitetura da Aplicação**, fluxo de estado unidirecional e modelo de dados (`INode`, `IConnections`, `IRunData`, `IPinData`).
> 4. A **Organização dos Componentes**, geometria matemática do Canvas (Grid `16px`, Curvas de Bézier, Loops SmoothStep, Snap Magnético de Conexões, Minimapa com Máscara `evenodd`) e **Regras de Interação UX** que não devem ser quebradas em edições futuras.

---

## 1. Visão Geral do Projeto & Origem (Engenharia Reversa REA)

O projeto `n8n-reconstructed` é uma reconstrução full-stack moderna e customizada da plataforma de automação de workflows **n8n**, construída a partir de evidências estáticas extraídas da instalação local do `n8n@1.118.1`:
- **Pacote Core Analisado (`n8n-workflow`)**:
  - `Workflow.js` (modelo de grafo direcionado, indexação reversa `connectionsByDestinationNode`, travessia de ancestrais/descendentes).
  - `WorkflowExecute.js` (motor de execução determinístico baseado em pilha `nodeExecutionStack` e fila de sincronização multi-input `waitingExecution`).
- **Pacote UI Analisado (`n8n-editor-ui`)**:
  - `Canvas-Td0SIV0U.js` e `Canvas-Bn6gWZ4a.css` (geometria de nós no grid `16px`, curvas de conexão, `@vue-flow/minimap`, handles `main` e `ai_*`).
  - `index-D9KM9gTZ.css` (sistema de Design Tokens primitivos e semânticos).

Sobre essa base fiel ao n8n, aplicamos customizações específicas de **Design & UX**:
1. **Tema Padrão "Branco Gelo" (Ice-White)**: Superfície do canvas em `#f3f7fb` com pontos do grid em `#cdd8e6`.
2. **Sidebar Esquerda Minimizável (`LeftSidebar.tsx`)**: Biblioteca de componentes arrastáveis (`Drag-and-Drop` para o Canvas) na parte superior + **Chat Copiloto IA** integrado na parte inferior.
3. **Sidebar Direita Contextual (`RightNodeSidebar.tsx`)**: Inspetor completo do nó (Parâmetros, Dados I/O em tempo real e Metadados/Conexões) que **abre exclusivamente ao clicar em um componente** (nunca ao arrastar).
4. **Conexão Magnética Inteligente ("Bolinha")**: Portas de entrada/saída centralizadas com área de captura de `28x28px` e *snap* magnético automático ao aproximar o fio de uma porta (`<= 48px`) ou sobrevoar o corpo de qualquer componente compatível.

---

## 2. Stack Tecnológica & Scripts de Execução

| Camada | Tecnologias Utilizadas | Detalhes Técnicos |
| :--- | :--- | :--- |
| **Frontend UI** | **React 18.3 + TypeScript 5.6** | Componentes funcionais fortemente tipados, Hooks (`useMemo`, `useCallback`, `useRef`) para zero jitter em 60fps. |
| **Build & Bundler** | **Vite 6.0** | HMR (Hot Module Replacement) instantâneo na porta `5173` e proxy `/api` configurado para `http://localhost:4000`. |
| **Ícones** | **Lucide React (`lucide-react`)** | Mapeamento dinâmico em `NodeIcon.tsx` para todos os tipos de nós e barras de ferramentas. |
| **Estilização** | **CSS Variables (`n8n-tokens.css`) + Inline Dynamic Styles** | Tokens semânticos do n8n customizados para o tema **Branco Gelo** (`light`) e suporte a modo escuro (`body[data-theme="dark"]`). |
| **Workflow Engine** | **TypeScript Puro (`src/engine/`)** | Grafo `Workflow` e executor `WorkflowExecute` isomórficos (rodam tanto no navegador em tempo real quanto no backend Node.js). |
| **Backend API** | **Node.js + Express 4.21 + CORS (`tsx`)** | Servidor REST na porta `4000` (`server/index.ts`) para persistência de workflows e execução remota. |

### Comandos do Projeto (`c:\Users\Kayke\OneDrive\Área de Trabalho\Reverse_engeener\n8n-reconstructed`)
```bash
# Iniciar Frontend Vite com HMR (http://localhost:5173)
npm run dev

# Iniciar Backend Express API (http://localhost:4000)
npm run server

# Iniciar Frontend + Backend simultaneamente
npm run dev:all

# Verificar tipagem TypeScript e gerar bundle de produção
npm run build
```

---

## 3. Estrutura de Diretórios e Arquivos

```text
n8n-reconstructed/
├── index.html                        # Entrypoint HTML (fonte Inter + JetBrains Mono)
├── package.json                      # Dependências e scripts npm
├── tsconfig.json                     # Configuração TypeScript estrita
├── vite.config.ts                    # Configuração Vite (porta 5173 + proxy /api -> 4000)
├── ARCHITECTURE_AND_LLM_GUIDE.md     # Este guia arquitetural para LLMs e desenvolvedores
├── server/
│   └── index.ts                      # API Express na porta 4000 (GET/POST workflows, POST /api/workflows/:id/run)
└── src/
    ├── main.tsx                      # Bootstrap React 18 + importação de n8n-tokens.css
    ├── App.tsx                       # Orquestrador de Estado Global, Layout Principal e Ações do Grafo
    ├── styles/
    │   └── n8n-tokens.css            # Design Tokens (Branco Gelo & Dark), animações e estilos do Minimapa/Handles
    ├── engine/                       # Núcleo Lógico (Independente de UI)
    │   ├── types.ts                  # Contratos TypeScript (INode, IConnections, IRunData, IPinData, etc.)
    │   ├── nodeTypes.ts              # Registro dos 12 tipos de nós nativos, propriedades, portas e cores
    │   ├── workflow.ts               # Classe Workflow (grafo direcionado, conexões reversas, avaliador ={{...}})
    │   ├── workflowExecute.ts        # Classe WorkflowExecute (pilha de execução, waitingExecution, sub-nós IA)
    │   ├── geometry.ts               # Matemática do Canvas (Grid 16px, Bezier, SmoothStep Loops, Auto-Layout)
    │   └── sampleWorkflows.ts        # Templates de Workflows prontos para teste e demonstração
    └── components/                   # Camada Visual e Interativa
        ├── TopNavBar.tsx             # Barra superior (Nome do workflow, seletor de templates, Run, Tema, Export JSON)
        ├── LeftSidebar.tsx           # Sidebar Esquerda Minimizável (Paleta Drag-and-Drop + Chat Copiloto IA inferior)
        ├── Canvas.tsx                # Canvas Interativo (Pan/Zoom, Nós, Portas Magnéticas, Arestas SVG, Minimapa)
        ├── RightNodeSidebar.tsx      # Sidebar Direita Contextual (Parâmetros, Dados I/O e Info ao clicar num nó)
        ├── NodeDetailsModal.tsx      # Modal NDV de 3 colunas em tela cheia (Input | Parâmetros | Output)
        ├── NodeCreatorDrawer.tsx     # Drawer contextual para inserção rápida a partir do botão "+" de uma porta/aresta
        ├── ExecutionLogsDrawer.tsx   # Gaveta inferior retraível com timeline e métricas de execução por nó
        └── NodeIcon.tsx              # Renderizador de ícones vetoriais por tipo de componente
```

---

## 4. Arquitetura da Página e Layout das Regiões

A interface principal (`App.tsx`) é organizada em uma estrutura **Full-Viewport (`100vw × 100vh`, `overflow: hidden`)** dividida em 4 regiões coordenadas:

```
+--------------------------------------------------------------------------------------------------+
| TopNavBar (56px fixo)                                                                            |
| [Logo] [Nome Editável] [Tag Ativo] [Templates v] | [+ Add Node] [Logs] [JSON] [Tema] [▶ Executar]|
+------------------------+------------------------------------------------+------------------------+
| LeftSidebar            | Canvas Central ("Branco Gelo" #f3f7fb)         | RightNodeSidebar       |
| (310px ou 54px rail)   | (flex: 1, Pan/Zoom infinito, Grid 16px)        | (375px condicional)    |
|                        |                                                |                        |
| 1. Biblioteca de       |   [Sticky Notes Layer]                         | Só aparece ao CLICAR   |
|    Componentes         |   [SVG Edges Layer (Bezier / SmoothStep)]      | em um nó no Canvas!    |
|    - Busca & Filtros   |   [Edge Labels & Hover Toolbars (+ / Lixeira)] |                        |
|    - Cards Arrastáveis |   [Interactive Nodes + Magnetic Handles]       | - Header & Status      |
|      (Drag -> Canvas)  |                                                | - [Executar] [Pin] ... |
|                        |                                                | - Aba 1: Parâmetros    |
| ---------------------- | +------------------+                           | - Aba 2: Dados (I/O)   |
| 2. Assistente IA       | | Minimapa 200x120 |                           | - Aba 3: Info & Fluxo  |
|    (Chat Integrado)    | +------------------+                           |                        |
|    - Chips Rápidos     | [Ponteiro|Mão|Mapa|Fit|Zoom+|Zoom-|Reset|Tidy] |                        |
|    - Histórico & Input |                                                |                        |
+------------------------+------------------------------------------------+------------------------+
| ExecutionLogsDrawer (Opcional / Retraível na base - 210px)                                       |
+--------------------------------------------------------------------------------------------------+
```

---

## 5. Detalhamento dos Módulos e Componentes

### 5.1. Camada de Engine (`src/engine/`)

1. **[`types.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/types.ts)**:
   - Define os tipos centrais idênticos ao n8n:
     - `NodeConnectionType`: `'main' | 'ai_languageModel' | 'ai_memory' | 'ai_tool'`
     - `INode`: `{ id, name, type, typeVersion, position: [x, y], disabled?, notes?, parameters }`
     - `IConnections`: Dicionário indexado por `sourceNode -> connectionType -> branchIndex -> Array<{ node, type, index }>`
     - `IRunData`: Histórico de execução por nó (`ITaskData[]` contendo `startTime`, `executionTime`, `executionStatus`, `data` e `error`).
2. **[`nodeTypes.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/nodeTypes.ts)**:
   - Catálogo declarativo `NODE_TYPE_DESCRIPTIONS` com 12 componentes divididos em 6 categorias (`trigger`, `core`, `flow`, `ai`, `ai_subnode`, `annotation`):
     - **Gatilhos (`isTrigger: true`, borda esquerda `36px`)**: `manualTrigger`, `webhook`.
     - **Ações Core (`96×96px`)**: `httpRequest`, `set` (Edit Fields), `code` (JavaScript sandbox).
     - **Controle de Fluxo (`96×96px`)**: `if` (2 saídas: `true`/`false`), `switch` (3 saídas: `0`, `1`, `fallback`), `merge` (2 entradas `main`).
     - **Agente IA Configurável (`isConfigurable: true`, `256×96px`)**: `@n8n/n8n-nodes-langchain.agent` (possui entradas `main` na esquerda e 3 portas losango `ai_*` na borda inferior).
     - **Sub-Nós de IA (`isConfiguration: true`, circular `80×80px`)**: `lmChatOpenAi`, `memoryBufferWindow`, `toolCalculator` (conectam-se de baixo para cima nas portas losango do AI Agent).
     - **Anotação (`isSticky: true`)**: `stickyNote` (7 variantes de cor).
3. **[`workflow.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/workflow.ts)**:
   - Constrói o mapa `nodes` (por nome) e calcula `connectionsByDestinationNode` via `Workflow.getConnectionsByDestination(connections)`.
   - Implementa `getStartNode()`, `getChildNodes()`, `getParentNodes()` e o avaliador dinâmico de expressões `evaluateExpression(expr, context)` que resolve `={{$json...}}`, `={{$node["Nome"].json...}}`, `={{$parameter["..."]}}` e `={{$now}}`.
4. **[`workflowExecute.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/workflowExecute.ts)**:
   - Reconstrução fiel do `WorkflowExecute.processRunExecutionData`:
     - Usa `nodeExecutionStack` (LIFO/FIFO) e `waitingExecution` para sincronizar nós com múltiplas entradas (como `Merge`).
     - Respeita `pinData` (dados fixados substituem a execução real) e `disabled` (nós desativados repassam o payload do primeiro input adiante).
     - Resolve sub-nós de IA (`ai_languageModel`, `ai_memory`, `ai_tool`) conectados ao `AI Agent` e dispara callbacks `onNodeExecuteBefore` e `onNodeExecuteAfter` para animar o Canvas em tempo real.
5. **[`geometry.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/geometry.ts)**:
   - `GRID_SIZE = 16` e `snapToGrid(val, 16)`.
   - `getNodeDimensions(node)` e `getNodeHandles(node)` (calcula offsets exatos `offsetX, offsetY` para cada porta na esquerda, direita, topo ou base).
   - `getEdgeRenderData(...)`:
     - Conexões para frente (`targetX >= sourceX - 16`): Curva de Bézier cúbica suave (`computeBezierPath`).
     - Conexões para trás / Loops (`targetX < sourceX - 16` em portas `main`): Rota ortogonal `SmoothStep` dividida em 2 segmentos que contorna por baixo dos nós (`centerY = Math.max(sourceY, targetY) + 112`).
   - `tidyUpWorkflowNodes(nodes, connections)`: Auto-layout topológico em camadas alinhado ao grid de `16px`.

---

### 5.2. Camada de Componentes UI (`src/components/`)

1. **[`App.tsx`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/App.tsx)**:
   - Gerencia o estado mestre: `workflow`, `runData`, `pinData`, `selectedNodeNames`, `rightSidebarNodeName`, `activeDetailsNodeName` e `theme` (inicializado como `'light'` — Branco Gelo).
   - Coordena todas as mutações imutáveis no grafo (`handleUpdateNodePosition`, `handleUpdateNode`, `handleRenameNode`, `handleConnect`, `handleDeleteConnection`, `handleAddNodeFromCreator`, `handleDropNodeOnCanvas`).
2. **[`LeftSidebar.tsx`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/components/LeftSidebar.tsx)**:
   - **Estado Minimizável (`isCollapsed`)**: Alterna entre `310px` (expandido) e `54px` (barra vertical compacta com ícones arrastáveis e atalho do Chat IA).
   - **Seção Superior (Componentes)**: Busca textual + abas de categoria + cards com `draggable={true}` que definem `e.dataTransfer.setData('application/n8n-node-type', item.name)`.
   - **Seção Inferior (Assistente IA / Copilot)**: Chat interativo com altura ajustável (`275px` ou `410px`) ou recolhível (`44px`), chips de comando rápido e interpretador de intenções que pode criar nós, executar o workflow, acionar o *Tidy Up* ou focar/explicar nós do fluxo.
3. **[`Canvas.tsx`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/components/Canvas.tsx)**:
   - Renderiza o plano infinito com transformação CSS `translate(viewport.x, viewport.y) scale(viewport.zoom)`.
   - Suporta **Drop de Componentes (`onDragOver` / `onDrop`)** vindos da `LeftSidebar`, convertendo `(clientX, clientY)` para coordenadas do mundo via `screenToCanvas` e alinhando ao grid de `16px`.
   - **Minimapa Fiel ao `@vue-flow/minimap` (`200×120px`, canto inferior esquerdo)**:
     - Calcula `boundingRect` como a união dos nós com a janela atual da câmera (`viewBB`).
     - Renderiza `<path className="n8n-minimap-mask" fillRule="evenodd" />` que escurece a área externa e recorta uma janela transparente sobre `viewBB`.
     - **Congelamento de `viewBox` durante o arraste (`frozenMinimapView`)**: Ao clicar/arrastar no minimapa, congela a escala para eliminar qualquer loop de realimentação/oscilação. Suporta também zoom via roda do mouse (`handleMinimapWheel`).
4. **[`RightNodeSidebar.tsx`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/components/RightNodeSidebar.tsx)**:
   - Painel lateral direito (`375px`) que exibe todas as informações do nó clicado:
     - **Header**: Ícone, nome editável inline, versão, badge de status (`Executado`, `Pinado`, `Desativado`), botão `Expandir` (abre `NodeDetailsModal`) e botão `Fechar`.
     - **Barra de Ações Rápidas**: `Executar Nó`, `Pin Data`, `Ativar/Desativar`, `Duplicar` e `Excluir`.
     - **3 Abas**: `Parâmetros` (edição ao vivo + preview de expressões `={{...}}` + notas), `Dados (I/O)` (JSON de Output e Input) e `Info & Conexões` (ID, tipo, posição X/Y e navegação entre nós pais/filhos).

---

## 6. Invariantes Críticas de UX (Regras para Futuras LLMs)

> **ATENÇÃO (NÃO QUEBRE ESTES COMPORTAMENTOS EM EDIÇÕES FUTURAS)**:

1. **A Sidebar Direita (`RightNodeSidebar`) SÓ deve abrir ao CLICAR em um nó (nunca ao arrastar)**:
   - Em `Canvas.tsx`, o evento `handleNodeMouseDown` **não** deve abrir a sidebar direita.
   - A abertura ocorre exclusivamente dentro de `stopAllInteractions` (no `mouseup`), verificando `if (finished.type === 'node' && !finished.isDragging && finished.nodeName) { onOpenNodeDetails(finished.nodeName); }`.
   - Da mesma forma, arrastar e soltar um componente da `LeftSidebar` no Canvas (`handleDropNodeOnCanvas`) apenas adiciona e seleciona visualmente o nó, sem abrir a `RightNodeSidebar`.
2. **Prevenção de "Mouse Preso" no Canvas (`DRAG_THRESHOLD_PX = 5` + Listeners Globais)**:
   - O arraste de pan do mapa ou movimentação de nó só inicia após o cursor mover pelo menos `5px` (`Math.hypot(rawDx, rawDy) >= DRAG_THRESHOLD_PX`).
   - Os listeners de `mousemove`, `mouseup` e `blur` estão registrados em `window` e possuem guarda `if (e.buttons === 0)` no início do `mousemove` para liberar imediatamente qualquer estado caso o mouse saia da janela.
3. **Geometria e Snap Magnético da "Bolinha" de Conexão (`handles`)**:
   - Cada porta (handle) possui um container de captura de `28×28px` centralizado em `(h.offsetX, h.offsetY)` com `transform: translate(-50%, -50%)`.
   - O botão `+` de portas desconectadas fica em `position: absolute; left: 50%; marginLeft: 7px` para **nunca** deslocar a bolinha do centro da borda do nó.
   - Durante o arraste de uma conexão (`connecting`), `handleWindowMouseMove` busca automaticamente qualquer porta compatível a até `48px` do cursor **ou** qualquer componente compatível cujo corpo esteja sob o cursor (`isCursorOverNodeBody`), gravando em `connecting.snappedTarget`. Ao soltar o mouse (`mouseup`), a conexão é efetivada automaticamente com `snappedTarget`.
4. **Minimapa sem Oscilação (`frozenMinimapView`)**:
   - Nunca recalcule o `viewBox` ativo do minimapa usando `viewport.x / viewport.y` enquanto o próprio usuário estiver arrastando dentro do minimapa. Mantenha o uso de `frozenMinimapView` durante o `mousedown -> mousemove` do minimapa e limpe-o apenas no `mouseup`.

---

## 7. Sistema de Formatos Visuais (`NodeShapeVariant`), Protótipo IA (Gateway + Skills + MCP) e Integração LLM

### 7.1. Formatos e Cores Distintas por Tipo de Bloco (Mantendo as Conexões do n8n)
Para tornar a construção visual intuitiva para **usuários não-técnicos** sem perder a engenharia de linhas e portas do n8n (`main` esquerda/direita + portas losango `ai_languageModel`, `ai_memory`, `ai_tool` com linhas tracejadas `8,8` e snap magnético), cada bloco possui um `shapeVariant`, `badgeLabel` e `color` próprios em [`src/engine/types.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/types.ts), [`src/engine/geometry.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/geometry.ts) e [`src/styles/n8n-tokens.css`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/styles/n8n-tokens.css):

| Bloco / Categoria | Tipo (`type`) | `shapeVariant` | Dimensões | Formato & Cor de Destaque | Porta de Conexão n8n |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pedido / Entrada** | `ai.promptInput` | `prompt-pill` | `208 × 80 px` | Pílula assimétrica esquerda (`40px 14px 14px 40px`), **Violeta (`#6366f1`)**, badge `PEDIDO` | Saída `main` (direita) |
| **AI Agent (Cérebro)** | `@n8n/n8n-nodes-langchain.agent` | `agent-card` | `256 × 96 px` | Card largo (`16px` radius), **Coral (`#ff6d5a`)**, badge `AGENTE IA` | Entrada/Saída `main` + 3 portas losango na base (`Chat Model`, `Memory`, `Skill / MCP`) |
| **Gateway de Modelos** | `ai.modelGateway` | `gateway-capsule` | `176 × 72 px` | Cápsula completa (`999px` radius), **Verde Esmeralda (`#10b981`)**, badge `GATEWAY LLM` | Saída losango no topo (`ai_languageModel`) |
| **Skill Especializada** | `ai.skillSlideTranscriber` | `skill-hexagon` | `176 × 76 px` | Cantos chanfrados diagonais (`22px 6px 22px 6px`), **Âmbar (`#f59e0b`)**, badge `SKILL` | Saída losango no topo (`ai_tool`) |
| **Conector MCP** | `ai.mcpGoogleSlides` | `mcp-shield` | `176 × 76 px` | Escudo invertido (`6px 22px 6px 22px`), **Azul Céu (`#0ea5e9`)**, badge `MCP SERVER` | Saída losango no topo (`ai_tool`) |
| **Entrega / Resposta** | `ai.responseOutput` | `output-card` | `208 × 80 px` | Pílula assimétrica direita (`14px 40px 40px 14px`), **Verde (`#16a34a`)**, badge `ENTREGA` | Entrada/Saída `main` |

---

### 7.2. Como Funciona a Montagem Automática via LLM (`aiWorkflowGenerator.ts`)
O módulo [`src/engine/aiWorkflowGenerator.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/aiWorkflowGenerator.ts) + endpoint `POST /api/ai/generate-workflow` em [`server/index.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/server/index.ts) permitem que o usuário peça no chat inferior da `LeftSidebar`:
- *"Monte um agente para transcrever slides do Google Slides usando o Gemini"*
- *"Troque o modelo do gateway para Claude 3.7 Sonnet"*

Fluxo de execução:
1. **Envio para LLM Real (Opcional / Plug-and-Play)**:
   - Se o usuário colar uma `GEMINI_API_KEY` no botão **🔑 Chave** no cabeçalho do chat (ou definir `GEMINI_API_KEY` no ambiente do servidor Express), `generateWorkflowFromPrompt` envia `LLM_WORKFLOW_SYSTEM_PROMPT` com `responseMimeType: "application/json"` para `gemini-2.5-flash`.
2. **Construtor Semântico Local Instantâneo (`buildSemanticWorkflowFromPrompt`)**:
   - Caso nenhuma chave de API esteja configurada, o construtor semântico local monta ou atualiza instantaneamente os blocos (`ai.promptInput` → `AI Agent` + `ai.modelGateway` + `ai.skillSlideTranscriber` + `ai.mcpGoogleSlides` → `ai.responseOutput`), cria todas as conexões `main`, `ai_languageModel` e `ai_tool`, e aplica `tidyUpWorkflowNodes` para alinhar tudo sem sobreposição no grid de `16px`.

---

## 8. Guia Rápido de Extensão para Futuras Tarefas

- **Como adicionar uma nova Skill ou novo MCP no futuro**:
  1. Abra [`src/engine/nodeTypes.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/nodeTypes.ts) e adicione um novo bloco com `category: 'ai_subnode'`, `isConfiguration: true`, `isInlineCard: true`, `shapeVariant: 'skill-hexagon'` (para Skills) ou `'mcp-shield'` (para MCPs), e `outputs: [{ type: 'ai_tool', displayName: 'MCP' }]`.
  2. Para conectar a execução real de um servidor MCP ou API de LLM durante o clique em *Execute Workflow*, adicione a chamada assíncrona correspondente em `executeSupplementalSubNodes` ou no `case '@n8n/n8n-nodes-langchain.agent'` dentro de [`src/engine/workflowExecute.ts`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/engine/workflowExecute.ts).
- **Como alterar Cores ou Tema**:
  1. Edite as variáveis CSS e as classes `.shape-*` em [`src/styles/n8n-tokens.css`](file:///c:/Users/Kayke/OneDrive/Área%20de%20Trabalho/Reverse_engeener/n8n-reconstructed/src/styles/n8n-tokens.css) (bloco `:root` para o tema Branco Gelo padrão e `body[data-theme='dark']` para o tema escuro).



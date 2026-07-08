# 🏆 Documentação Oficial do Projeto: SportConnect (Módulo Torneio de Dominó)

## 1. Visão Geral do Sistema

O **SportConnect** é uma plataforma de gestão esportiva desenvolvida para automatizar e profissionalizar a organização de torneios de dominó. O sistema elimina o uso de papel, oferecendo uma Súmula Digital para o mesário (árbitro) e um painel de acompanhamento em tempo real (Chaveamento) para a torcida.

O sistema foi arquitetado dividindo as rotas entre o acesso público (visualização de chaves e resultados) e um painel administrativo protegido por PIN para o controle operacional do evento.

## 2. Stack Tecnológica e Arquitetura

A plataforma foi construída utilizando tecnologias modernas de desenvolvimento web, garantindo alta performance e escalabilidade:

* **Front-end:** Next.js (React) com renderização híbrida.
* **Estilização:** Tailwind CSS, incluindo suporte nativo e alternância manual de temas (Light/Dark Mode).
* **Banco de Dados (BaaS):** Supabase (PostgreSQL) para armazenamento de dados relacionais e em tempo real.
* **Hospedagem & Deploy:** Vercel, com integração contínua (CI/CD) via GitHub.
* **Gerenciamento de Estado:** React Hooks e passagem de estado dinâmico para renderização dos chaveamentos.

## 3. Regras de Negócio Implementadas

O sistema foi moldado para refletir o regulamento oficial do torneio, traduzindo regras do mundo real para lógica de código:

* **Pontuação Base:** Vitórias simples valem 1 ponto; vitórias batendo nas duas pontas ("lá e lô") valem 2 pontos.
* **Regra da Quadra:** A partida regular é encerrada automaticamente quando uma dupla atinge a marca de 4 pontos.
* **Modo Semifinal (Melhor de 3):** O sistema identifica automaticamente partidas de fase avançada e altera a lógica para "Sets". O placar é zerado a cada quadra alcançada, e a partida só encerra quando uma equipe vence 2 sets.
* **Trancamento / Fechamento de Mesa:** Implementação de botão de "Rodada Valendo o Dobro", que multiplica a pontuação (2x ou 4x) na rodada seguinte a um fechamento de mesa.
* **Feature Flag de Eliminatória:** O formato do campeonato é controlado por uma variável de ambiente, permitindo alternar facilmente entre Eliminatória Simples (Mata-mata) ou Eliminatória Dupla (com Chave de Repescagem) sem perda de código.

## 4. Estrutura de Módulos

### 👁️ Visão Pública (Torcida)

* **Árvore de Confrontos:** Visualização gráfica e auto-ajustável dos jogos agendados, em andamento e finalizados.
* **Painel de Jogos ao Vivo (Carrossel):** Partidas com status "LIVE" entram em destaque no topo da tela, permitindo rolagem horizontal em dispositivos móveis.

### ⚙️ Painel de Administração (Protegido por PIN)

* **Módulo de Gestão de Duplas:** Inserção manual de equipes e estruturação do banco de dados inicial.
* **Área do Árbitro (Súmula Digital):** Painel focado em usabilidade, com destaque claro da partida ativa. Contabiliza pontos, desfaz ações e calcula automaticamente o encerramento das partidas e a progressão das duplas vencedoras para a próxima fase do chaveamento.


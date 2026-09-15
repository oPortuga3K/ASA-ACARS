# ASA-ACARS server-module

Este diretório contém os 4 módulos phpVMS 7 necessários para o cliente ASA-ACARS (Atlantic Star Airways).

## Módulos:

- **AsaCore**: Gestão de dados avançados de aterragem (score, fpm, g-force), controlo de versão do cliente, heartbeats de voo e sistema de crowdsource de pistas.
- **AsaLogbook**: Extensão do logbook que serve dados estatísticos do piloto e histórico de voos com os dados extra recolhidos pelo AsaCore.
- **AsaNews**: Sistema de tracking de leitura de notícias (marca notícias como lidas por cada piloto e serve contadores de unread).
- **AsaVATraffic**: Serve a posição em tempo real de todos os pilotos ativos na VA para visualização no mapa do cliente.

## Instalação no phpVMS 7

1. Copie as 4 pastas (`AsaCore`, `AsaLogbook`, `AsaNews`, `AsaVATraffic`) para a diretoria `modules/` na raiz da instalação do seu phpVMS 7.
2. Ative os módulos na consola do servidor:
   ```bash
   php artisan module:enable AsaCore
   php artisan module:enable AsaLogbook
   php artisan module:enable AsaNews
   php artisan module:enable AsaVATraffic
   ```
3. Corra as migrações para criar as tabelas extra na base de dados:
   ```bash
   php artisan module:migrate AsaCore
   php artisan module:migrate AsaNews
   ```

## Configuração

O módulo **AsaCore** possui um ficheiro `Config/config.php` onde se pode:
- Definir a versão mínima e recomendada do cliente ASA-ACARS
- Ativar/desativar funcionalidades (Runway Crowdsource, Live Tracking, Chat)
- Modificar as regras de aceitação de relatórios de aterragem
import { criarAplicacao } from './aplicacao.ts';
import { carregarConfig } from './config.ts';
import { criarPools } from './infra/db/pools.ts';

const config = carregarConfig();
const pools = criarPools(config);
const app = await criarAplicacao({ config, pools });

const encerrar = async (sinal: string) => {
  app.log.info({ sinal }, 'encerrando');
  await app.close();
  await pools.encerrar();
  process.exit(0);
};

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));

await app.listen({ port: config.PORTA, host: '0.0.0.0' });

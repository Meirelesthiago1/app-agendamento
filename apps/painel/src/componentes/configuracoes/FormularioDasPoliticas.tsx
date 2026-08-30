import {
  aplicarErrosServidor,
  type Politicas,
  politicasDoEstabelecimento,
} from '@agendamento/contratos';
import {
  Acordeao,
  Alternancia,
  Aviso,
  Botao,
  Campo,
  Cartao,
  ItemDoAcordeao,
  Passo,
  Selecao,
} from '@agendamento/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useSalvarPoliticas } from '../../lib/configuracao.ts';

type Chave = keyof Politicas;

type Booleana = {
  [K in Chave]: Politicas[K] extends boolean ? K : never;
}[Chave];

const INTERRUPTORES: { chave: Booleana; rotulo: string; apoio: string }[] = [
  {
    chave: 'confirmacaoAutomatica',
    rotulo: 'Confirmar agendamentos automaticamente',
    apoio: 'Desligado, cada pedido entra como aguardando e precisa da sua confirmação.',
  },
  {
    chave: 'permiteSemCadastro',
    rotulo: 'Permitir agendar sem criar conta',
    apoio: 'O cliente informa nome e telefone e pronto.',
  },
  {
    chave: 'permiteMultiplosServicos',
    rotulo: 'Permitir vários serviços no mesmo horário',
    apoio: 'Até cinco por agendamento.',
  },
  {
    chave: 'exigeOtpTelefone',
    rotulo: 'Confirmar o telefone por código',
    apoio: 'Reduz agendamento falso, e acrescenta um passo a quem agenda.',
  },
  {
    chave: 'staffVeAgendaCompleta',
    rotulo: 'Funcionário vê a agenda de todos',
    apoio: 'Ver a agenda dos outros; escrever nela continua sendo só na própria.',
  },
  {
    chave: 'folgaPodeExcederJanela',
    rotulo: 'Folga pode passar do horário de trabalho',
    apoio: 'O atendimento sempre cabe na janela; a folga é preparo, e pode transbordar.',
  },
];

const SEM_LIMITE = 0;

export function FormularioDasPoliticas({ politicas }: { politicas: Politicas }) {
  const salvar = useSalvarPoliticas();

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(politicasDoEstabelecimento),
    values: politicas,
  });

  const enviar = handleSubmit(async (valores) => {
    try {
      const salva = await salvar.mutateAsync(valores);

      reset(salva.politicas);
    } catch (erro) {
      if (!aplicarErrosServidor(erro, setError as never)) {
        setError('root', { message: 'Não foi possível salvar. Tente de novo.' });
      }
    }
  });

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {errors.root?.message !== undefined ? (
        <Aviso tom="negativo" titulo="Não foi possível salvar">
          {errors.root.message}
        </Aviso>
      ) : null}

      <Cartao>
        <Acordeao type="multiple" defaultValue={['tempo']}>
          <ItemDoAcordeao value="tempo" titulo="Tempo e janela">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                rotulo="Granularidade dos horários"
                apoio="De quanto em quanto tempo os horários são oferecidos"
                erro={errors.granularidadeSlotMin?.message}
              >
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="granularidadeSlotMin"
                    render={({ field }) => (
                      <Passo
                        {...ligacao}
                        value={field.value}
                        onChange={field.onChange}
                        passo={5}
                        minimo={5}
                        maximo={120}
                        unidade="min"
                      />
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Estratégia"
                apoio="Grade fixa a cada intervalo, ou compacto encostando um no outro"
                erro={errors.estrategiaSlot?.message}
              >
                {(ligacao) => (
                  <Selecao {...ligacao} {...register('estrategiaSlot')}>
                    <option value="GRADE">Grade</option>
                    <option value="COMPACTO">Compacto</option>
                  </Selecao>
                )}
              </Campo>

              <Campo
                rotulo="Antecedência mínima"
                apoio="Quanto tempo antes o cliente ainda consegue agendar"
                erro={errors.antecedenciaMinimaMin?.message}
              >
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="antecedenciaMinimaMin"
                    render={({ field }) => (
                      <Passo
                        {...ligacao}
                        value={field.value}
                        onChange={field.onChange}
                        passo={15}
                        maximo={43_200}
                        unidade="min"
                      />
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Janela de agendamento"
                apoio="Até quantos dias à frente a agenda fica aberta"
                erro={errors.janelaAgendamentoDias?.message}
              >
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="janelaAgendamentoDias"
                    render={({ field }) => (
                      <Passo
                        {...ligacao}
                        value={field.value}
                        onChange={field.onChange}
                        minimo={1}
                        maximo={365}
                        unidade="dias"
                      />
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Prazo para cancelar"
                apoio="Depois disso, o cliente já não cancela sozinho"
                erro={errors.prazoCancelamentoMin?.message}
              >
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="prazoCancelamentoMin"
                    render={({ field }) => (
                      <Passo
                        {...ligacao}
                        value={field.value}
                        onChange={field.onChange}
                        passo={60}
                        maximo={43_200}
                        unidade="min"
                      />
                    )}
                  />
                )}
              </Campo>

              <Campo
                rotulo="Máximo de agendamentos ativos por cliente"
                apoio="Zero é sem limite"
                erro={errors.maxAtivosPorCliente?.message}
              >
                {(ligacao) => (
                  <Controller
                    control={control}
                    name="maxAtivosPorCliente"
                    render={({ field }) => (
                      <Passo
                        {...ligacao}
                        // Nulo é "sem limite", e o Passo é numérico: zero na
                        // tela vira nulo no contrato, que é o que o banco guarda
                        value={field.value ?? SEM_LIMITE}
                        onChange={(valor) => field.onChange(valor === SEM_LIMITE ? null : valor)}
                        maximo={100}
                      />
                    )}
                  />
                )}
              </Campo>
            </div>
          </ItemDoAcordeao>

          <ItemDoAcordeao value="reserva" titulo="Reserva e acesso">
            <div className="flex flex-col gap-4">
              {INTERRUPTORES.map((interruptor) => (
                <Controller
                  key={interruptor.chave}
                  control={control}
                  name={interruptor.chave}
                  render={({ field }) => (
                    <div className="flex items-start gap-3">
                      <Alternancia
                        id={interruptor.chave}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />

                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor={interruptor.chave}
                          className="text-sm font-medium text-conteudo"
                        >
                          {interruptor.rotulo}
                        </label>
                        <p className="text-xs text-conteudo-suave">{interruptor.apoio}</p>
                      </div>
                    </div>
                  )}
                />
              ))}
            </div>
          </ItemDoAcordeao>
        </Acordeao>
      </Cartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={salvar.isPending} disabled={!isDirty}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}

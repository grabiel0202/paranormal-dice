
import { useCallback, useEffect, useState } from "react";
import App from "./App";
import { garantirAutenticacao } from "./lib/auth";
import {
  criarSala,
  solicitarEntrada,
  decidirEntrada,
  consultarEntrada,
  listarSolicitacoes,
  listarParticipantes,
  recuperarSala,
} from "./lib/salas";

import "./Multiplayer.css";

const INTERVALO_ATUALIZACAO = 4000;

export default function Multiplayer() {
  const [usuario, setUsuario] = useState(null);
  const [inicializando, setInicializando] = useState(true);

  const [apelido, setApelido] = useState("");
  const [personagem, setPersonagem] = useState("");
  const [nomeSala, setNomeSala] = useState("");
  const [codigo, setCodigo] = useState("");

  const [sala, setSala] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [participantes, setParticipantes] = useState([]);

  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  // ==========================================
  // AUTENTICAÇÃO E RECUPERAÇÃO DA SALA
  // ==========================================

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      try {
        const usuarioAtual = await garantirAutenticacao();

        const salaAnterior = await recuperarSala();

        if (!ativo) return;

        setUsuario(usuarioAtual);

        if (salaAnterior) {
          setSala(salaAnterior);
          setAviso(
            "Sua sessão foi recuperada automaticamente."
          );
        }
      } catch (e) {
        if (ativo) {
          setErro(
            e.message ||
              "Não foi possível conectar ao Supabase."
          );
        }
      } finally {
        if (ativo) {
          setInicializando(false);
        }
      }
    }

    iniciar();

    return () => {
      ativo = false;
    };
  }, []);

  // ==========================================
  // ATUALIZAR INFORMAÇÕES DA SALA
  // ==========================================

  const atualizar = useCallback(async () => {
    if (!sala?.codigo) return;

    const info = await consultarEntrada(sala.codigo);

    if (!info) {
      setSala(null);
      setPedidos([]);
      setParticipantes([]);
      setAviso(
        "A sala não está mais disponível ou você perdeu o acesso."
      );
      return;
    }

    setSala((atual) =>
      atual ? { ...atual, ...info } : atual
    );

    if (info.papel === "mestre") {
      const [novosPedidos, novosParticipantes] =
        await Promise.all([
          listarSolicitacoes(info.sala_id),
          listarParticipantes(info.sala_id),
        ]);

      setPedidos(novosPedidos);
      setParticipantes(novosParticipantes);
    } else {
      setPedidos([]);
      setParticipantes([]);
    }
  }, [sala?.codigo]);

  // ==========================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ==========================================

  useEffect(() => {
    if (!sala?.codigo) return;

    let ativo = true;
    let emAndamento = false;

    async function executarAtualizacao() {
      if (!ativo || emAndamento) return;

      emAndamento = true;

      try {
        await atualizar();
      } catch (e) {
        if (ativo) {
          setErro(
            e.message ||
              "Falha ao atualizar informações da sala."
          );
        }
      } finally {
        emAndamento = false;
      }
    }

    executarAtualizacao();

    const intervalo = window.setInterval(
      executarAtualizacao,
      INTERVALO_ATUALIZACAO
    );

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [sala?.codigo, atualizar]);

  // ==========================================
  // EXECUTAR AÇÕES COM TRATAMENTO DE ERROS
  // ==========================================

  async function executar(acao) {
    setCarregando(true);
    setErro("");
    setAviso("");

    try {
      await acao();
    } catch (e) {
      setErro(
        e.message || "Ocorreu um erro inesperado."
      );
    } finally {
      setCarregando(false);
    }
  }

  // ==========================================
  // CRIAR SALA
  // ==========================================

  function criar() {
    executar(async () => {
      if (apelido.trim().length < 2) {
        throw new Error(
          "O apelido precisa ter pelo menos 2 caracteres."
        );
      }

      if (nomeSala.trim().length < 3) {
        throw new Error(
          "O nome da sala precisa ter pelo menos 3 caracteres."
        );
      }

      const nova = await criarSala(
        nomeSala.trim(),
        apelido.trim()
      );

      if (!nova) {
        throw new Error(
          "Não foi possível criar a sala."
        );
      }

      setSala({
        sala_id: nova.sala_id,
        codigo: nova.codigo,
        nome_sala: nomeSala.trim(),
        papel: "mestre",
        status: "aprovado",
      });

      setAviso("Sala criada com sucesso!");
    });
  }

  // ==========================================
  // SOLICITAR ENTRADA
  // ==========================================

  function entrar() {
    executar(async () => {
      if (apelido.trim().length < 2) {
        throw new Error(
          "Informe um apelido com pelo menos 2 caracteres."
        );
      }

      if (!codigo.trim()) {
        throw new Error(
          "Informe o código da sala."
        );
      }

      const codigoFormatado =
        codigo.trim().toUpperCase();

      await solicitarEntrada(
        codigoFormatado,
        apelido.trim(),
        personagem.trim()
      );

      const info = await consultarEntrada(
        codigoFormatado
      );

      if (!info) {
        throw new Error(
          "Não foi possível localizar sua solicitação."
        );
      }

      setSala(info);

      setAviso(
        info.status === "aprovado"
          ? "Você entrou na sala!"
          : "Solicitação enviada. Aguarde a aprovação do mestre."
      );
    });
  }

  // ==========================================
  // APROVAR OU RECUSAR JOGADOR
  // ==========================================

  function decidir(id, aprovado) {
    executar(async () => {
      await decidirEntrada(id, aprovado);
      await atualizar();

      setAviso(
        aprovado
          ? "Jogador aprovado com sucesso!"
          : "Solicitação recusada."
      );
    });
  }

  // ==========================================
  // ATUALIZAÇÃO MANUAL
  // ==========================================

  async function atualizarManual() {
    if (atualizando) return;

    setAtualizando(true);
    setErro("");

    try {
      await atualizar();
      setAviso("Informações atualizadas.");
    } catch (e) {
      setErro(
        e.message || "Não foi possível atualizar."
      );
    } finally {
      setAtualizando(false);
    }
  }

  // ==========================================
  // COPIAR CÓDIGO
  // ==========================================

  async function copiarCodigo() {
    if (!sala?.codigo) return;

    try {
      await navigator.clipboard.writeText(
        sala.codigo
      );

      setAviso("Código copiado!");
    } catch {
      setAviso(
        `Copie este código manualmente: ${sala.codigo}`
      );
    }
  }

  // ==========================================
  // VOLTAR À TELA INICIAL
  // ==========================================

  function voltar() {
    setSala(null);
    setPedidos([]);
    setParticipantes([]);
    setErro("");
    setAviso("");
  }

  // ==========================================
  // TELA DE CARREGAMENTO
  // ==========================================

  if (inicializando) {
    return (
      <div className="multi-fundo">
        <div className="multi-painel">
          <p className="multi-etiqueta">
            PARANORMAL DICE
          </p>

          <h1>◈ Conectando...</h1>

          <p>
            Verificando sua autenticação e procurando
            uma sessão anterior.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA DE ERRO DE AUTENTICAÇÃO
  // ==========================================

  if (!usuario) {
    return (
      <div className="multi-fundo">
        <div className="multi-painel">
          <h1>◈ PARANORMAL DICE</h1>

          <p>
            Não foi possível iniciar sua sessão.
          </p>

          {erro && (
            <p
              className="multi-erro"
              role="alert"
            >
              {erro}
            </p>
          )}

          <button
            onClick={() =>
              window.location.reload()
            }
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA INICIAL
  // ==========================================

  if (!sala) {
    return (
      <div className="multi-fundo">
        <div className="multi-painel">
          <p className="multi-etiqueta">
            PARANORMAL DICE • V0.7
          </p>

          <h1>Entre no outro lado.</h1>

          <p>
            Crie uma sessão como mestre ou solicite
            autorização para entrar em uma sala.
          </p>

          <label>
            Seu apelido

            <input
              maxLength={40}
              value={apelido}
              onChange={(e) =>
                setApelido(e.target.value)
              }
              placeholder="Ex.: Gabriel"
            />
          </label>

          <div className="multi-duas-colunas">
            <section>
              <h2>♛ Criar sala</h2>

              <label>
                Nome da sessão

                <input
                  maxLength={80}
                  value={nomeSala}
                  onChange={(e) =>
                    setNomeSala(e.target.value)
                  }
                  placeholder="Ex.: Caso do Sanatório"
                />
              </label>

              <button
                disabled={carregando}
                onClick={criar}
              >
                {carregando
                  ? "Aguarde..."
                  : "Criar como mestre"}
              </button>
            </section>

            <section>
              <h2>Entrar na sala</h2>

              <label>
                Código da sala

                <input
                  maxLength={8}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="Ex.: A1B2C3D4"
                />
              </label>

              <label>
                Personagem (opcional)

                <input
                  maxLength={80}
                  value={personagem}
                  onChange={(e) =>
                    setPersonagem(e.target.value)
                  }
                  placeholder="Ex.: Dante"
                />
              </label>

              <button
                disabled={carregando}
                onClick={entrar}
              >
                {carregando
                  ? "Aguarde..."
                  : "Solicitar entrada"}
              </button>
            </section>
          </div>

          {erro && (
            <p
              className="multi-erro"
              role="alert"
            >
              {erro}
            </p>
          )}

          {aviso && (
            <p className="multi-aviso">
              {aviso}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // INFORMAÇÕES DA SALA
  // ==========================================

  const mestre = sala.papel === "mestre";
  const aprovado = sala.status === "aprovado";

  // ==========================================
  // INTERFACE DA SALA
  // ==========================================

  return (
    <div className="multi-fundo">
      <div className="multi-barra">
        <div>
          <strong>
            ◈ {sala.nome_sala || "Sala paranormal"}
          </strong>

          <span>
            Código: <b>{sala.codigo}</b>
            {" · "}
            {mestre
              ? "Mestre"
              : aprovado
              ? "Jogador aprovado"
              : "Aguardando aprovação"}
          </span>
        </div>

        <div className="multi-acoes">
          <button
            onClick={copiarCodigo}
          >
            Copiar código
          </button>

          <button
            onClick={atualizarManual}
            disabled={atualizando}
          >
            {atualizando
              ? "Atualizando..."
              : "Atualizar"}
          </button>

          <button
            onClick={voltar}
            className="multi-secundario"
          >
            Voltar ao início
          </button>
        </div>
      </div>

      {erro && (
        <p
          className="multi-erro multi-alerta"
          role="alert"
        >
          {erro}
        </p>
      )}

      {aviso && (
        <p className="multi-aviso">
          {aviso}
        </p>
      )}

      {/* ===================================
          PAINEL DO MESTRE
      =================================== */}

      {mestre && (
        <div className="multi-painel multi-administracao">
          <h2>♛ Painel do mestre</h2>

          <h3>
            Solicitações pendentes (
            {pedidos.length})
          </h3>

          {pedidos.length === 0 ? (
            <p>
              Nenhum jogador aguardando aprovação.
            </p>
          ) : (
            pedidos.map((p) => (
              <div
                className="multi-item"
                key={p.id}
              >
                <div>
                  <strong>
                    {p.apelido}
                  </strong>

                  <small>
                    Personagem:{" "}
                    {p.personagem ||
                      "Não informado"}
                  </small>
                </div>

                <div className="multi-acoes">
                  <button
                    disabled={carregando}
                    onClick={() =>
                      decidir(p.id, true)
                    }
                  >
                    Aprovar
                  </button>

                  <button
                    className="multi-secundario"
                    disabled={carregando}
                    onClick={() =>
                      decidir(p.id, false)
                    }
                  >
                    Recusar
                  </button>
                </div>
              </div>
            ))
          )}

          <h3>
            Participantes aprovados (
            {participantes.length})
          </h3>

          {participantes.length === 0 ? (
            <p>
              Nenhum participante encontrado.
            </p>
          ) : (
            participantes.map((p) => (
              <div
                className="multi-item"
                key={p.id}
              >
                <div>
                  <strong>
                    {p.apelido}
                  </strong>

                  <small>
                    {p.personagem ||
                      "Sem personagem"}
                  </small>
                </div>

                <span>
                  {p.papel === "mestre"
                    ? "♛ Mestre"
                    : "Jogador"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================================
          TELA DE ESPERA
      =================================== */}

      {!aprovado ? (
        <div className="multi-painel multi-espera">
          <h2>
            ⌛ Aguardando o mestre
          </h2>

          <p>
            Sua solicitação está{" "}
            <strong>
              {sala.status}
            </strong>.
          </p>

          <p>
            A situação é verificada
            automaticamente a cada 4 segundos.
          </p>

          <p>
            Você poderá acessar a mesa quando
            o mestre aprovar sua entrada.
          </p>

          {sala.status === "recusado" && (
            <p className="multi-erro">
              Sua solicitação foi recusada.
              Volte ao início para tentar
              novamente.
            </p>
          )}

          <button
            onClick={atualizarManual}
            disabled={atualizando}
          >
            Verificar aprovação
          </button>
        </div>
      ) : (
        <>
          {/* MESA COM DADOS 3D */}

          <App
            key={sala.sala_id}
            salaId={sala.sala_id}
            mestre={mestre}
          />

          <p className="multi-rodape">
            Sala conectada ao Supabase.
            As rolagens são compartilhadas
            automaticamente entre os
            participantes.
          </p>
        </>
      )}
    </div>
  );
}


import { supabase } from "./supabase";
import { garantirAutenticacao } from "./auth";

// ========================================
// CRIAR SALA
// ========================================
export async function criarSala(nome, apelido) {
  await garantirAutenticacao();

  const { data, error } = await supabase.rpc(
    "criar_sala",
    {
      p_nome: nome,
      p_apelido: apelido,
    }
  );

  if (error) throw error;

  return data?.[0] ?? null;
}

// ========================================
// SOLICITAR ENTRADA NA SALA
// ========================================
export async function solicitarEntrada(
  codigo,
  apelido,
  personagem
) {
  await garantirAutenticacao();

  const { data, error } = await supabase.rpc(
    "solicitar_entrada",
    {
      p_codigo: codigo,
      p_apelido: apelido,
      p_personagem: personagem || null,
    }
  );

  if (error) throw error;

  return data;
}

// ========================================
// APROVAR OU RECUSAR JOGADOR
// ========================================
export async function decidirEntrada(
  solicitacaoId,
  aprovar
) {
  await garantirAutenticacao();

  const { data, error } = await supabase.rpc(
    "decidir_entrada",
    {
      p_solicitacao_id: solicitacaoId,
      p_aprovar: aprovar,
    }
  );

  if (error) throw error;

  return data;
}

// ========================================
// CONSULTAR ENTRADA PELO CÓDIGO
// ========================================
export async function consultarEntrada(codigo) {
  await garantirAutenticacao();

  const { data, error } = await supabase.rpc(
    "consultar_entrada",
    {
      p_codigo: codigo,
    }
  );

  if (error) throw error;

  return data?.[0] ?? null;
}

// ========================================
// LISTAR SOLICITAÇÕES PENDENTES
// ========================================
export async function listarSolicitacoes(salaId) {
  await garantirAutenticacao();

  const { data, error } = await supabase
    .from("solicitacoes_entrada")
    .select("*")
    .eq("sala_id", salaId)
    .eq("status", "pendente")
    .order("solicitada_em", {
      ascending: true,
    });

  if (error) throw error;

  return data ?? [];
}

// ========================================
// LISTAR PARTICIPANTES DA SALA
// ========================================
export async function listarParticipantes(salaId) {
  await garantirAutenticacao();

  const { data, error } = await supabase
    .from("participantes")
    .select("*")
    .eq("sala_id", salaId)
    .order("entrou_em", {
      ascending: true,
    });

  if (error) throw error;

  return data ?? [];
}

// ========================================
// RECUPERAR SALA APÓS F5
// ========================================
export async function recuperarSala() {
  await garantirAutenticacao();

  // Recupera salas e solicitações vinculadas
  // ao usuário autenticado.
  const { data, error } = await supabase.rpc(
    "minhas_salas"
  );

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  // Prioriza salas em que o usuário já foi aprovado.
  const salasOrdenadas = [...data].sort((a, b) => {
    const prioridade = (sala) =>
      sala.status === "aprovado" ? 0 : 1;

    return prioridade(a) - prioridade(b);
  });

  // Futuramente, criaremos um seletor para
  // escolher entre várias salas.
  return salasOrdenadas[0];
}


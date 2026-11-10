
import { supabase } from "./supabase";
import { garantirAutenticacao } from "./auth";

export async function criarRolagem({
  salaId,
  lados,
  quantidade,
  modificador = 0,
  modo = "soma",
  secreta = false,
}) {
  await garantirAutenticacao();

  const { data, error } = await supabase.rpc("rolar_dados", {
    p_sala_id: salaId,
    p_lados: lados,
    p_quantidade: quantidade,
    p_modificador: modificador,
    p_modo: modo,
    p_secreta: secreta,
  });

  if (error) throw error;

  if (!data?.[0]) {
    throw new Error("O servidor não retornou a rolagem.");
  }

  return data[0];
}

export async function listarRolagens(salaId) {
  await garantirAutenticacao();

  const { data, error } = await supabase
    .from("rolagens")
    .select(
      "id, sala_id, jogador, lados, quantidade, resultados, modificador, modo, total, secreta, criada_em"
    )
    .eq("sala_id", salaId)
    .order("criada_em", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data ?? [];
}

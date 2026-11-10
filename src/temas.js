
export const TEMAS = {
  sangue: {
    nome: "Sangue",
    destaque: "#f04462",
    forte: "#a71f3c",
    fundo: "#100d14",
    painel: "#1b1420",
    borda: "#653044",
    dado: "#461a30",
    luz: "#ff234a",
    texto: "#f5edf0",
  },
  azul: {
    nome: "Energia Azul",
    destaque: "#4999ff",
    forte: "#2456bd",
    fundo: "#081322",
    painel: "#111f35",
    borda: "#335b93",
    dado: "#174c9b",
    luz: "#42b8ff",
    texto: "#edf5ff",
  },
  verde: {
    nome: "Conhecimento Verde",
    destaque: "#48d887",
    forte: "#18794b",
    fundo: "#081710",
    painel: "#12271d",
    borda: "#326b4c",
    dado: "#165c39",
    luz: "#50ff99",
    texto: "#eafff0",
  },
  roxo: {
    nome: "Oculto",
    destaque: "#b78bff",
    forte: "#7545bc",
    fundo: "#140e22",
    painel: "#241a35",
    borda: "#614787",
    dado: "#59388d",
    luz: "#b78bff",
    texto: "#f5edff",
  },
};

export function aplicarTema(nome) {
  const tema = TEMAS[nome] || TEMAS.sangue;

  const raiz = document.documentElement;

  raiz.style.setProperty("--tema-destaque", tema.destaque);
  raiz.style.setProperty("--tema-forte", tema.forte);
  raiz.style.setProperty("--tema-fundo", tema.fundo);
  raiz.style.setProperty("--tema-painel", tema.painel);
  raiz.style.setProperty("--tema-borda", tema.borda);
  raiz.style.setProperty("--tema-texto", tema.texto);

  return tema;
}

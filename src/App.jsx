import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Edges } from "@react-three/drei";
import { Dices, Volume2, VolumeX, Palette } from "lucide-react";
import * as THREE from "three";

import { TEMAS, aplicarTema } from "./temas";
import { tocarSomRolagem } from "./somDados";

import "./App.css";
import "./temas.css";
import "./v07.css";
import { criarRolagem, listarRolagens } from "./lib/rolagens";

const TIPOS = [2, 3, 4, 6, 8, 10, 12, 20, 100];
const DURACAO = 2.5;
const FRENTE = new THREE.Vector3(0, 0, 1);

// ==========================================
// GERAR ID COMPATÍVEL COM CELULAR
// ==========================================

function gerarIdRolagem() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return `${Date.now()}-${Math.random()}`;
}

// ==========================================
// SORTEIO DOS DADOS
// ==========================================

function sortearNumero(lados) {
  const maximo = 4294967296;
  const limite = Math.floor(maximo / lados) * lados;

  if (
    typeof crypto === "undefined" ||
    !crypto.getRandomValues
  ) {
    throw new Error(
      "Este navegador não oferece sorteio seguro. Acesse o site por HTTPS ou localhost."
    );
  }

  const array = new Uint32Array(1);

  do {
    crypto.getRandomValues(array);
  } while (array[0] >= limite);

  return (array[0] % lados) + 1;
}

// ==========================================
// GEOMETRIA D10
// ==========================================

function criarGeometriaD10() {
  const raio = 1.5;
  const alturaPolo = 1.7;
  const alturaBaixa = -0.2;
  const cos36 = Math.cos(Math.PI / 5);

  const alturaAlta =
    alturaPolo * (1 - cos36) + cos36 * alturaBaixa;

  const vertices = [
    new THREE.Vector3(0, alturaPolo, 0),
    new THREE.Vector3(0, -alturaPolo, 0),
  ];

  for (let i = 0; i < 10; i++) {
    const angulo = (i * Math.PI) / 5;

    vertices.push(
      new THREE.Vector3(
        Math.cos(angulo) * raio,
        i % 2 === 0 ? alturaAlta : alturaBaixa,
        Math.sin(angulo) * raio
      )
    );
  }

  const posicoes = [];

  function triangulo(a, b, c) {
    const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];

    const normal = new THREE.Vector3()
      .subVectors(vb, va)
      .cross(new THREE.Vector3().subVectors(vc, va));

    const centro = va.clone()
      .add(vb)
      .add(vc)
      .divideScalar(3);

    const pontos =
      normal.dot(centro) < 0
        ? [va, vc, vb]
        : [va, vb, vc];

    pontos.forEach((p) => {
      posicoes.push(p.x, p.y, p.z);
    });
  }

  for (let i = 1; i < 10; i += 2) {
    const anterior = 2 + ((i + 9) % 10);
    const atual = 2 + i;
    const proximo = 2 + ((i + 1) % 10);

    triangulo(0, anterior, atual);
    triangulo(0, atual, proximo);
  }

  for (let i = 0; i < 10; i += 2) {
    const anterior = 2 + ((i + 9) % 10);
    const atual = 2 + i;
    const proximo = 2 + ((i + 1) % 10);

    triangulo(1, anterior, atual);
    triangulo(1, atual, proximo);
  }

  const geometria = new THREE.BufferGeometry();

  geometria.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posicoes, 3)
  );

  geometria.computeVertexNormals();

  return geometria;
}

// ==========================================
// GEOMETRIAS D2 E D3
// ==========================================

function criarGeometriaD2() {
  const geometria = new THREE.CylinderGeometry(
    1.45,
    1.45,
    0.34,
    64
  );

  geometria.rotateX(Math.PI / 2);

  return geometria;
}

function criarGeometriaD3() {
  const geometria = new THREE.CylinderGeometry(
    1.5,
    1.5,
    2.2,
    3,
    1
  );

  geometria.rotateX(Math.PI / 2);

  return geometria;
}

// ==========================================
// SELEÇÃO DE GEOMETRIA
// ==========================================

function criarGeometria(lados) {
  switch (lados) {
    case 2:
      return criarGeometriaD2();

    case 3:
      return criarGeometriaD3();

    case 4:
      return new THREE.TetrahedronGeometry(1.8, 0);

    case 6:
      return new THREE.BoxGeometry(2.5, 2.5, 2.5);

    case 8:
      return new THREE.OctahedronGeometry(1.8, 0);

    case 10:
      return criarGeometriaD10();

    case 12:
      return new THREE.DodecahedronGeometry(1.8, 0);

    case 20:
      return new THREE.IcosahedronGeometry(1.8, 0);

    default:
      throw new Error("Tipo de dado inválido.");
  }
}

// ==========================================
// IDENTIFICAR FACES DOS DADOS
// ==========================================

function extrairFaces(geometria, lados) {
  const posicoes = geometria.getAttribute("position");
  const indice = geometria.getIndex();
  const grupos = [];

  function obterVertice(i) {
    const posicao = indice ? indice.getX(i) : i;

    return new THREE.Vector3().fromBufferAttribute(
      posicoes,
      posicao
    );
  }

  const total = indice ? indice.count : posicoes.count;

  for (let i = 0; i < total; i += 3) {
    const a = obterVertice(i);
    const b = obterVertice(i + 1);
    const c = obterVertice(i + 2);

    const centro = a.clone()
      .add(b)
      .add(c)
      .divideScalar(3);

    const normal = b.clone()
      .sub(a)
      .cross(c.clone().sub(a))
      .normalize();

    if (normal.dot(centro) < 0) {
      normal.negate();
    }

    const distancia = normal.dot(centro);

    let grupo = grupos.find(
      (g) =>
        g.normal.dot(normal) > 0.9999 &&
        Math.abs(g.distancia - distancia) < 0.001
    );

    if (!grupo) {
      grupo = {
        normal: normal.clone(),
        distancia,
        vertices: [],
      };

      grupos.push(grupo);
    }

    grupo.vertices.push(a, b, c);
  }

  const gruposNumerados =
    lados === 3
      ? grupos.filter((g) => Math.abs(g.normal.z) < 0.5)
      : grupos;

  return gruposNumerados.map((grupo, i) => {
    const unicos = [];

    grupo.vertices.forEach((vertice) => {
      if (
        !unicos.some(
          (v) => v.distanceTo(vertice) < 0.0001
        )
      ) {
        unicos.push(vertice);
      }
    });

    const centro = new THREE.Vector3();

    unicos.forEach((v) => centro.add(v));

    centro.divideScalar(unicos.length);
    centro.addScaledVector(grupo.normal, 0.055);

    const orientacao = new THREE.Quaternion()
      .setFromUnitVectors(FRENTE, grupo.normal);

    return {
      numero: i + 1,
      centro,
      normal: grupo.normal,
      orientacao,
    };
  });
}

// ==========================================
// DADO 3D COM SKIN DINÂMICA
// ==========================================

function Dado3D({
  lados,
  numero,
  token,
  posicao = [0, 0, 0],
  escala = 1,
  percentual = false,
  tema = TEMAS.sangue,
}) {
  const grupo = useRef(null);
  const animacao = useRef(null);
  const ultimoToken = useRef(null);

  const { geometria, faces } = useMemo(() => {
    const geometria = criarGeometria(lados);

    const faces =
      lados === 2
        ? [
            {
              numero: 1,
              centro: new THREE.Vector3(0, 0, 0.185),
              normal: new THREE.Vector3(0, 0, 1),
              orientacao: new THREE.Quaternion(),
            },
            {
              numero: 2,
              centro: new THREE.Vector3(0, 0, -0.185),
              normal: new THREE.Vector3(0, 0, -1),
              orientacao: new THREE.Quaternion()
                .setFromAxisAngle(
                  new THREE.Vector3(0, 1, 0),
                  Math.PI
                ),
            },
          ]
        : extrairFaces(geometria, lados);

    if (faces.length !== lados) {
      console.warn(
        `D${lados}: esperado ${lados} faces, encontradas ${faces.length}`
      );
    }

    return { geometria, faces };
  }, [lados]);

  useEffect(() => {
    return () => geometria.dispose();
  }, [geometria]);

  useFrame((estado) => {
    if (!grupo.current) return;

    if (token && ultimoToken.current !== token) {
      ultimoToken.current = token;

      const face = faces.find(
        (f) => f.numero === numero
      );

      if (!face) return;

      const destino = face.orientacao.clone().invert();

      animacao.current = {
        inicio: grupo.current.quaternion.clone(),
        destino,
        tempo: estado.clock.elapsedTime,
      };
    }

    if (!animacao.current) return;

    const a = animacao.current;

    const t = Math.min(
      (estado.clock.elapsedTime - a.tempo) / DURACAO,
      1
    );

    const suave = 1 - Math.pow(1 - t, 3);

    const base = a.inicio.clone()
      .slerp(a.destino, suave);

    const eixo = new THREE.Vector3(
      1,
      0.7,
      0.4
    ).normalize();

    const giro = new THREE.Quaternion()
      .setFromAxisAngle(
        eixo,
        2 * Math.PI * 5 * suave
      );

    grupo.current.quaternion.copy(
      giro.multiply(base)
    );

    if (t >= 1) {
      grupo.current.quaternion.copy(a.destino);
      animacao.current = null;
    }
  });

  const fonte =
    lados === 2
      ? 0.9
      : lados === 3
      ? 0.7
      : lados === 20
      ? 0.26
      : lados === 12 || lados === 10
      ? 0.32
      : 0.4;

  return (
    <group position={posicao} scale={escala}>
      <group ref={grupo}>
        <mesh geometry={geometria}>
          <meshStandardMaterial
            color={tema.dado}
            metalness={0.55}
            roughness={0.3}
            flatShading
            side={THREE.DoubleSide}
          />

          <Edges
            color={tema.destaque}
            threshold={10}
          />
        </mesh>

        {faces.map((face) => (
          <Text
            key={face.numero}
            position={face.centro.toArray()}
            quaternion={face.orientacao}
            fontSize={fonte}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#000000"
          >
            {percentual && face.numero === 10
              ? "0"
              : face.numero}
          </Text>
        ))}
      </group>
    </group>
  );
}

// ==========================================
// DISPOSIÇÃO DOS DADOS
// ==========================================

function calcularColunas(layout, quantidade) {
  if (layout === "linha") return quantidade;
  if (layout === "coluna") return 1;

  return quantidade <= 3
    ? quantidade
    : Math.ceil(Math.sqrt(quantidade));
}

// ==========================================
// MESA DOS DADOS
// ==========================================

function MesaDados({
  rolagem,
  lados,
  quantidade,
  layout,
  tema = TEMAS.sangue,
}) {
  const tipo = rolagem?.lados ?? lados;

  const resultados =
    rolagem?.resultados ??
    Array.from({ length: quantidade }, () => 1);

  const itens = resultados.flatMap((valor, i) => {
    if (tipo !== 100) {
      return [
        {
          key: String(i),
          numero: valor,
          lados: tipo,
          titulo: `Dado ${i + 1}`,
        },
      ];
    }

    const convertido = valor === 100 ? 0 : valor;
    const dezena = Math.floor(convertido / 10);
    const unidade = convertido % 10;

    return [
      {
        key: `${i}-dez`,
        numero: dezena === 0 ? 10 : dezena,
        lados: 10,
        percentual: true,
        titulo: `D${i + 1} · dezenas`,
      },
      {
        key: `${i}-uni`,
        numero: unidade === 0 ? 10 : unidade,
        lados: 10,
        percentual: true,
        titulo: `D${i + 1} · unidades`,
      },
    ];
  });

  const colunas = calcularColunas(
    layout,
    resultados.length
  );

  const colunasVisuais =
    tipo === 100 ? colunas * 2 : colunas;

  return (
    <div
      className="grade-dados"
      style={{
        "--colunas-dados": colunasVisuais,
      }}
    >
      {itens.map((item) => (
        <div
          className="dado-celula"
          key={item.key}
        >
          <div className="mini-mesa">
            <Canvas
              camera={{
                position: [0, 0, 7.5],
                fov: 45,
              }}
              dpr={[1, 1.5]}
              gl={{
                antialias: false,
                powerPreference: "high-performance",
              }}
            >
              <ambientLight intensity={1.8} />

              <directionalLight
                position={[5, 5, 5]}
                intensity={3}
              />

              <pointLight
                position={[-4, 2, 2]}
                color={tema.luz}
                intensity={25}
              />

              <Dado3D
                lados={item.lados}
                numero={item.numero}
                percentual={item.percentual}
                token={
                  rolagem
                    ? rolagem.id + item.key
                    : null
                }
                tema={tema}
              />
            </Canvas>
          </div>

          <small>{item.titulo}</small>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// APLICAÇÃO PRINCIPAL
// ==========================================

function App({ salaId = null, mestre = false }) {
  const [lados, setLados] = useState(20);
  const [apelido, setApelido] = useState("Investigador");

  const [quantidade, setQuantidade] = useState(1);
  const [modificador, setModificador] = useState(0);

  const [modo, setModo] = useState("soma");
  const [disposicao, setDisposicao] = useState("automatico");

  const [rolagem, setRolagem] = useState(null);
  const [rolando, setRolando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [erroRolagem, setErroRolagem] = useState("");
  const [secreta, setSecreta] = useState(false);
  const [historicoOnline, setHistoricoOnline] = useState([]);
  const [erroHistorico, setErroHistorico] = useState("");
  const [carregandoRolagem, setCarregandoRolagem] = useState(false);
  const enviandoRef = useRef(false);

  // ========================================
  // CONFIGURAÇÕES VISUAIS
  // ========================================

  const [temaSelecionado, setTemaSelecionado] =
    useState(() => {
      try {
        const salvo = localStorage.getItem(
          "paranormal-tema"
        );

        return TEMAS[salvo] ? salvo : "sangue";
      } catch {
        return "sangue";
      }
    });

  const [somAtivo, setSomAtivo] = useState(() => {
    try {
      return (
        localStorage.getItem("paranormal-som") !==
        "false"
      );
    } catch {
      return true;
    }
  });

  const tema =
    TEMAS[temaSelecionado] || TEMAS.sangue;

  // ========================================
  // SALVAR SKIN
  // ========================================

  useEffect(() => {
    aplicarTema(temaSelecionado);

    try {
      localStorage.setItem(
        "paranormal-tema",
        temaSelecionado
      );
    } catch {
      // Armazenamento indisponível.
    }
  }, [temaSelecionado]);

  // ========================================
  // SALVAR CONFIGURAÇÃO DE SOM
  // ========================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "paranormal-som",
        String(somAtivo)
      );
    } catch {
      // Armazenamento indisponível.
    }
  }, [somAtivo]);

  // ========================================
  // HISTÓRICO COMPARTILHADO (A CADA 3 SEGUNDOS)
  // ========================================

  useEffect(() => {
    if (!salaId) return;
    let ativo = true;
    let buscando = false;

    async function buscar() {
      if (buscando || !ativo) return;
      buscando = true;
      try {
        const dados = await listarRolagens(salaId);
        if (ativo) {
          setHistoricoOnline(dados);
          setErroHistorico("");
        }
      } catch (erro) {
        if (ativo) setErroHistorico(erro.message || "Erro ao consultar histórico.");
      } finally {
        buscando = false;
      }
    }

    setHistoricoOnline([]);
    buscar();
    const intervalo = window.setInterval(buscar, 3000);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [salaId]);

  // ========================================
  // FINALIZAR ANIMAÇÃO
  // ========================================

  useEffect(() => {
    if (!rolagem) return;

    const timer = window.setTimeout(() => {
      setRolando(false);

      setHistorico((anterior) =>
        anterior.some((r) => r.id === rolagem.id)
          ? anterior
          : [rolagem, ...anterior]
      );
    }, DURACAO * 1000 + 100);

    return () => window.clearTimeout(timer);
  }, [rolagem]);

  // ========================================
  // ROLAR DADOS
  // ========================================

  async function rolarDado() {
    if (rolando || enviandoRef.current) return;
    enviandoRef.current = true;
    setCarregandoRolagem(true);
    setErroRolagem("");

    try {
      const n = Math.min(6, Math.max(1, Number(quantidade) || 1));
      const bonus = Number(modificador) || 0;
      const modoEfetivo = lados === 20 ? modo : "soma";
      let nova;

      if (salaId) {
        // O servidor gera e calcula os resultados.
        const r = await criarRolagem({
          salaId, lados, quantidade: n, modificador: bonus,
          modo: modoEfetivo, secreta: mestre && secreta,
        });
        nova = {
          id: r.id,
          lados: r.lados,
          resultados: r.resultados,
          bonus: r.modificador,
          modo: r.modo,
          total: r.total,
          jogador: r.jogador,
          secreta: r.secreta,
          horario: new Date(r.criada_em).toLocaleTimeString("pt-BR"),
        };
        // Atualiza o histórico imediatamente para quem rolou.
        try {
          setHistoricoOnline(await listarRolagens(salaId));
          setErroHistorico("");
        } catch (erro) {
          setErroHistorico(erro.message || "Falha ao atualizar histórico.");
        }
      } else {
        const resultados = Array.from({ length: n }, () => sortearNumero(lados));
        const base = modoEfetivo === "maior"
          ? Math.max(...resultados)
          : resultados.reduce((a, b) => a + b, 0);
        nova = {
          id: gerarIdRolagem(), lados, resultados,
          bonus, modo: modoEfetivo, total: base + bonus,
          jogador: apelido.trim() || "Investigador",
          secreta: false,
          horario: new Date().toLocaleTimeString("pt-BR"),
        };
      }

      if (somAtivo) tocarSomRolagem();
      setRolando(true);
      setRolagem(nova);
    } catch (erro) {
      setErroRolagem(erro.message || "Erro ao rolar dados.");
      setRolando(false);
    } finally {
      setCarregandoRolagem(false);
      enviandoRef.current = false;
    }
  }

  // ========================================
  // SELECIONAR DADO
  // ========================================

  function selecionarDado(tipo) {
    if (rolando) return;

    setLados(tipo);
    setRolagem(null);
    setErroRolagem("");
  }

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <main className="app">
      <header>
        <div className="logo">
          ◈ PARANORMAL DICE
        </div>

        <span className="versao">
          VERSÃO 0.7
        </span>
      </header>

      {/* PERSONALIZAÇÃO */}

      <div className="painel-personalizacao">
        <label htmlFor="tema-dados">
          <Palette size={17} />
          Aparência da mesa
        </label>

        <select
          id="tema-dados"
          value={temaSelecionado}
          onChange={(e) =>
            setTemaSelecionado(e.target.value)
          }
        >
          {Object.entries(TEMAS).map(
            ([id, item]) => (
              <option key={id} value={id}>
                {item.nome}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          onClick={() =>
            setSomAtivo((atual) => !atual)
          }
          aria-pressed={somAtivo}
        >
          {somAtivo ? (
            <>
              <Volume2 size={17} />
              Som ligado
            </>
          ) : (
            <>
              <VolumeX size={17} />
              Som desligado
            </>
          )}
        </button>
      </div>

      <section className="conteudo">
        <p className="subtitulo">
          SUA SORTE ESTÁ LANÇADA
        </p>

        <h1>
          O destino está em suas mãos.
        </h1>

        <p className="descricao">
          Role os dados e descubra o que o
          outro lado reserva.
        </p>

        {/* APELIDO */}

        
        {/* APELIDO */}

        {!salaId && (
          <div className="campo-apelido">
            <label htmlFor="apelido">
              Investigador
            </label>

            <input
              id="apelido"
              value={apelido}
              maxLength={30}
              onChange={(e) =>
                setApelido(e.target.value)
              }
            />
          </div>
        )}

        {/* ROLAGEM SECRETA DO MESTRE */}

        {mestre && salaId && (
          <label className="v07-segredo">
            <input
              type="checkbox"
              checked={secreta}
              onChange={(e) =>
                setSecreta(e.target.checked)
              }
              disabled={rolando || carregandoRolagem}
            />
            <span>
              Rolagem secreta (somente o mestre vê)
            </span>
          </label>
        )}


        {/* TIPOS DE DADOS */}

        <div className="seletor-dados">
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={
                lados === tipo ? "dado-ativo" : ""
              }
              disabled={rolando}
              onClick={() =>
                selecionarDado(tipo)
              }
            >
              D{tipo}
            </button>
          ))}
        </div>

        {/* CONTROLES */}

        <div className="controles-rolagem">
          <div>
            <label htmlFor="quantidade">
              Quantidade de dados
            </label>

            <input
              id="quantidade"
              type="number"
              min="1"
              max="6"
              value={quantidade}
              disabled={rolando}
              onChange={(e) =>
                setQuantidade(
                  Math.min(
                    6,
                    Math.max(
                      1,
                      Number(e.target.value) || 1
                    )
                  )
                )
              }
            />
          </div>

          <div>
            <label htmlFor="modificador">
              Modificador
            </label>

            <input
              id="modificador"
              type="number"
              value={modificador}
              disabled={rolando}
              onChange={(e) =>
                setModificador(
                  Number(e.target.value) || 0
                )
              }
            />
          </div>

          {lados === 20 && (
            <div>
              <label htmlFor="modo">
                Cálculo do D20
              </label>

              <select
                id="modo"
                value={modo}
                disabled={rolando}
                onChange={(e) =>
                  setModo(e.target.value)
                }
              >
                <option value="soma">
                  Somar todos
                </option>

                <option value="maior">
                  Usar o maior (Ordem)
                </option>
              </select>
            </div>
          )}
        </div>

        {/* DISPOSIÇÃO */}

        <div className="opcoes-disposicao">
          <label htmlFor="disposicao">
            Disposição na mesa
          </label>

          <select
            id="disposicao"
            value={disposicao}
            onChange={(e) =>
              setDisposicao(e.target.value)
            }
          >
            <option value="automatico">
              Automática
            </option>

            <option value="linha">
              Lado a lado
            </option>

            <option value="grade">
              Grade
            </option>

            <option value="coluna">
              Coluna
            </option>
          </select>
        </div>

        {/* DADOS 3D */}

        <MesaDados
          rolagem={rolagem}
          lados={lados}
          quantidade={quantidade}
          tema={tema}
          layout={
            disposicao === "automatico"
              ? quantidade <= 3
                ? "linha"
                : "grade"
              : disposicao
          }
        />

        {/* RESULTADO */}

        <div
          className="resultado"
          aria-live="polite"
        >
          {carregandoRolagem
            ? "SORTEANDO NO SERVIDOR..."
            : rolando
            ? "ROLANDO..."
            : rolagem
            ? `RESULTADO: ${rolagem.total}`
            : "AGUARDANDO ROLAGEM"}
        </div>

        {rolagem && !rolando && (
          <p className="detalhes-resultado">
            Dados: [
            {rolagem.resultados.join(", ")}
            ] ·{" "}
            {rolagem.modo === "maior"
              ? "Maior resultado"
              : "Soma"}

            {rolagem.bonus >= 0
              ? ` + ${rolagem.bonus}`
              : ` - ${Math.abs(rolagem.bonus)}`}
          </p>
        )}

        {erroRolagem && (
          <p
            className="multi-erro"
            role="alert"
          >
            {erroRolagem}
          </p>
        )}

        {/* BOTÃO ROLAR */}

        <button
          className="botao-rolar"
          onClick={rolarDado}
          disabled={rolando || carregandoRolagem}
        >
          <Dices size={22} />

          {carregandoRolagem
            ? "CONSULTANDO SERVIDOR..."
            : rolando
            ? "ROLANDO..."
            : `ROLAR ${quantidade}D${lados}`}
        </button>

        {/* HISTÓRICO */}
        <div className="historico v07-historico">
          <h2>{salaId ? "Histórico compartilhado da sala" : "Histórico de rolagens"}</h2>
          {salaId && <p className="v07-atualizacao">Atualização automática a cada 3 segundos</p>}
          {erroHistorico && salaId && <p className="multi-erro" role="alert">{erroHistorico}</p>}
          {(salaId ? historicoOnline : historico).length === 0 ? (
            <p>Nenhuma rolagem realizada.</p>
          ) : (
            (salaId ? historicoOnline : historico).map((item) => {
              const valores = item.resultados || [];
              const bonus = item.modificador ?? item.bonus ?? 0;
              const horario = item.criada_em
                ? new Date(item.criada_em).toLocaleTimeString("pt-BR")
                : item.horario;
              return (
                <div className={`registro ${item.secreta ? "v07-registro-secreto" : ""}`} key={item.id}>
                  <span>
                    <strong className="v07-nome">{item.jogador}</strong>
                    {" — "}{valores.length}D{item.lados}
                    {item.secreta && <span className="v07-selo"> · SECRETA</span>}
                    <small className="registro-detalhes">
                      [{valores.join(", ")}]
                      {item.modo === "maior" ? " · maior" : " · soma"}
                      {bonus >= 0 ? ` +${bonus}` : ` ${bonus}`}
                      {" · "}{horario}
                    </small>
                  </span>
                  <strong>{item.total}</strong>
                </div>
              );
            })
          )}
        </div>
        <p className="aviso-local">
          {salaId
            ? "Resultados gerados e armazenados no Supabase. Rolagens secretas são visíveis apenas ao mestre."
            : "Modo local: entre em uma sala para compartilhar as rolagens."}
        </p>
      </section>
    </main>
  );
}

export default App;

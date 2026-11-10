
let contextoAudio = null;

export function tocarSomRolagem() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    if (!contextoAudio) {
      contextoAudio = new AudioContext();
    }

    if (contextoAudio.state === "suspended") {
      contextoAudio.resume().catch(() => {});
    }

    const inicio = contextoAudio.currentTime;

    function impacto(tempo, intensidade = 0.12) {
      const oscilador = contextoAudio.createOscillator();
      const volume = contextoAudio.createGain();

      oscilador.type = "triangle";

      oscilador.frequency.setValueAtTime(
        190,
        tempo
      );

      oscilador.frequency.exponentialRampToValueAtTime(
        65,
        tempo + 0.065
      );

      volume.gain.setValueAtTime(0.0001, tempo);
      volume.gain.exponentialRampToValueAtTime(
        intensidade,
        tempo + 0.005
      );
      volume.gain.exponentialRampToValueAtTime(
        0.0001,
        tempo + 0.09
      );

      oscilador.connect(volume);
      volume.connect(contextoAudio.destination);

      oscilador.start(tempo);
      oscilador.stop(tempo + 0.1);
    }

    // Pequenos impactos enquanto os dados giram.
    for (let i = 0; i < 9; i++) {
      impacto(
        inicio + i * 0.23,
        0.045 + i * 0.005
      );
    }

    // Impacto final quando os dados param.
    impacto(inicio + 2.45, 0.18);
  } catch (erro) {
    console.warn("Áudio indisponível:", erro);
  }
}

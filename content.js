console.log("Lichess Arrow Tracker v3.5 loaded");

let chess = null;
let lastArrows = new Set();
let isFlipped = false;
let displayBox = null;
let mouseButtonDown = false;

function createDisplayBox() {
  if (displayBox) return;
  displayBox = document.createElement('div');
  displayBox.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.9); color: #0f0;
    padding: 16px 22px; border-radius: 8px; font-family: monospace; font-size: 22px;
    z-index: 999999; border: 3px solid #0f0; pointer-events: none; display: none;
    min-width: 130px; text-align: center; font-weight: bold;
  `;
  document.body.appendChild(displayBox);
}

function showMove(text) {
  createDisplayBox();
  displayBox.textContent = text;
  displayBox.style.display = 'block';
  clearTimeout(displayBox.timeout);
  displayBox.timeout = setTimeout(() => {
    if (displayBox) displayBox.style.display = 'none';
  }, 6500);
}

function initExtension() {
  if (typeof Chess === 'undefined') {
    console.error("❌ chess.js not loaded");
    return;
  }

  chess = new Chess();
  syncBoardToChess();

  // Mouse tracking - right-click only
  document.addEventListener('mousedown', e => {
    if (e.button === 2) mouseButtonDown = true;
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 2) {
      mouseButtonDown = false;
      // Small delay so Lichess finishes drawing the final arrow
      setTimeout(processFinalArrows, 80);
    }
  });

  // Observer only watches for board changes, but never processes during drag
  const observer = new MutationObserver(() => {
    if (!mouseButtonDown) {
      // Only do light cleanup when not dragging
      lastArrows.clear(); // reset when arrows are removed
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log("✅ v3.5 ready — processes arrows ONLY after mouse release");
}

async function syncBoardToChess() {
  const fen = await getCurrentFEN();
  if (fen && chess) {
    try { chess.load(fen); } catch (e) {}
  }
}

function getCurrentFEN() {
  const cgWrap = document.querySelector('.cg-wrap');
  if (!cgWrap) return null;

  isFlipped = cgWrap.classList.contains('orientation-black');

  return new Promise(resolve => {
    let attempts = 0;
    const maxAttempts = 10;

    function tryRead() {
      attempts++;
      const pieces = document.querySelectorAll('piece');
      const board = Array(8).fill().map(() => Array(8).fill(''));
      let squareSize = cgWrap.offsetWidth / 8 || 64;

      let foundPieces = 0;

      pieces.forEach(piece => {
        if (piece.classList.contains('ghost') || piece.classList.contains('fading')) return;

        const transform = piece.style.transform || '';
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        if (!match) return;

        let x = parseFloat(match[1]);
        let y = parseFloat(match[2]);

        let file = Math.floor((x + squareSize * 0.5) / squareSize);
        let rank = Math.floor((y + squareSize * 0.5) / squareSize);

        file = Math.max(0, Math.min(7, file));
        rank = Math.max(0, Math.min(7, rank));

        const className = piece.className.toLowerCase();
        let type = '';
        if (className.includes('king')) type = 'k';
        else if (className.includes('queen')) type = 'q';
        else if (className.includes('rook')) type = 'r';
        else if (className.includes('bishop')) type = 'b';
        else if (className.includes('knight')) type = 'n';
        else if (className.includes('pawn')) type = 'p';

        if (!type) return;

        const color = className.includes('white') ? 'w' : 'b';
        const p = color === 'w' ? type.toUpperCase() : type;

        const displayRank = isFlipped ? 7 - rank : rank;
        const displayFile = isFlipped ? 7 - file : file;

        board[displayRank][displayFile] = p;
        foundPieces++;
      });

      if (foundPieces >= 28 || attempts >= maxAttempts) {
        let fen = '';
        for (let r = 0; r < 8; r++) {
          let empty = 0;
          for (let f = 0; f < 8; f++) {
            if (board[r][f]) {
              if (empty) fen += empty;
              fen += board[r][f];
              empty = 0;
            } else empty++;
          }
          if (empty) fen += empty;
          if (r < 7) fen += '/';
        }
        resolve(fen + (isFlipped ? ' b' : ' w') + ' - - 0 1');
      } else {
        setTimeout(tryRead, 60);
      }
    }
    tryRead();
  });
}

function processFinalArrows() {
  const shapesSVG = document.querySelector('svg.cg-shapes');
  if (!shapesSVG) return;

  const lines = shapesSVG.querySelectorAll('line');
  const currentArrowSet = new Set();

  lines.forEach(line => {
    let x1 = parseFloat(line.getAttribute('x1'));
    let y1 = parseFloat(line.getAttribute('y1'));
    let x2 = parseFloat(line.getAttribute('x2'));
    let y2 = parseFloat(line.getAttribute('y2'));

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    const from = coordsToSquare(x1, y1);
    const to = coordsToSquare(x2, y2);

    if (!from || !to || from === to) return;

    const key = `${from}-${to}`;
    currentArrowSet.add(key);

    if (!lastArrows.has(key)) {
      processNewArrow(from, to);
      lastArrows.add(key);
      console.log(`Final arrow: ${from} → ${to}`);
	  console.log(chess.ascii());
	  console.log(chess.turn());
    }
  });

  lastArrows.forEach(k => {
    if (!currentArrowSet.has(k)) lastArrows.delete(k);
  });
}

function coordsToSquare(x, y) {
  const file = Math.round((x + 4) * 7 / 8);
  const rank = Math.round((y + 4) * 7 / 8);

  let f = Math.max(0, Math.min(7, file));
  let r = Math.max(0, Math.min(7, rank));

  if (isFlipped) {
    f = 7 - f;
    r = 7 - r;
  }

  return String.fromCharCode(97 + f) + (8 - r);
}

function processNewArrow(from, to) {
  if (!chess) {
    showMove(`${from}→${to}`);
    return;
  }

  const uci = from + to;

  try {
    let move = chess.move(uci) || chess.move(uci, { sloppy: true }) || chess.move({ from, to, promotion: 'q' });
    if (move) {
      showMove(move.san);
      console.log(`✅ ${uci} → ${move.san}`);
      return;
    }
  } catch (e) {}

  showMove(`${from}→${to}`);
  console.log(`Raw arrow: ${from}→${to}`);
}

initExtension();
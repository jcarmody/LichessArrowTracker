console.log("Lichess Arrow Tracker v7.1 loaded");

let chess = null;
let lastArrows = new Set();
let moveHistory = [];
let mouseButtonDown = false;
let lastKnownFEN = "";
let lastFENCheck = 0;

function hasChatInput() {
  return !!document.querySelector('input.mchat__say, .mchat__say');
}

function clearChatInput() {
  const chatInput = document.querySelector('input.mchat__say, .mchat__say');
  if (chatInput) {
    chatInput.value = '';
    const event = new Event('input', { bubbles: true });
    chatInput.dispatchEvent(event);
  }
}

function getLastRealMoveContext() {
  const moveList = document.querySelector('l4x');
  if (!moveList) return "";

  const moves = moveList.querySelectorAll('kwdb');
  if (moves.length === 0) return "";

  const lastMoveText = moves[moves.length - 1].textContent.trim();
  const moveNumber = Math.floor(moves.length / 2) + 1;
  const isBlackMove = (moves.length % 2 === 0);

  if (isBlackMove) {
    return `${moveNumber}..${lastMoveText}`;
  } else {
    return `${moveNumber}.${lastMoveText}`;
  }
}

function fillChatInput() {
  if (moveHistory.length === 0) return;

  const chatInput = document.querySelector('input.mchat__say, .mchat__say');
  if (!chatInput) return;

  const context = getLastRealMoveContext();
  let fullText = "/w ";

  if (context) {
    fullText += `(${context}) `;
  }

  fullText += moveHistory.join(', ');

  chatInput.focus();
  chatInput.value = fullText;

  const event = new Event('input', { bubbles: true });
  chatInput.dispatchEvent(event);

  console.log("Filled chat with:", fullText);
}

function initExtension() {
  if (typeof Chess === 'undefined') {
    console.error("❌ chess.js not loaded");
    return;
  }

  chess = new Chess();
  syncBoardToChess();

  document.addEventListener('mousedown', e => {
    if (e.button === 2) mouseButtonDown = true;
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 2) {
      mouseButtonDown = false;
      setTimeout(addFinalArrowToHistory, 150);
    }
  });

  const observer = new MutationObserver(handleBoardChanges);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      fillChatInput();
    }
  });

  console.log("✅ v7.1 ready — precise edge coordinate mapping");
}

async function syncBoardToChess() {
  const fen = await getCurrentFEN();
  if (fen && chess) {
    try {
      chess.load(fen);
      lastKnownFEN = fen;
      console.log(`Virtual board synced. Turn: ${chess.turn() === 'w' ? 'White' : 'Black'}`);
    } catch (e) {
      console.warn("FEN load failed");
    }
  }
}

function handleBoardChanges() {
  if (mouseButtonDown) return;

  const now = Date.now();
  if (now - lastFENCheck < 1000) return;
  lastFENCheck = now;

  const shapesSVG = document.querySelector('svg.cg-shapes');
  const currentLines = shapesSVG ? shapesSVG.querySelectorAll('line').length : 0;

  if (currentLines === 0 && lastArrows.size > 0) {
    console.log("All arrows cleared → resetting");
    moveHistory = [];
    lastArrows.clear();
    clearChatInput();
    syncBoardToChess();
    return;
  }

  getCurrentFEN().then(currentFEN => {
    if (currentFEN && currentFEN !== lastKnownFEN) {
      console.log("Real move detected → resetting");
      moveHistory = [];
      lastArrows.clear();
      clearChatInput();
      syncBoardToChess();
    }
  });
}

function getCurrentFEN() {
  const cgWrap = document.querySelector('.cg-wrap');
  if (!cgWrap) return null;

  isFlipped = cgWrap.classList.contains('orientation-black');

  let isBlackToMove = false;
  const moveList = document.querySelector('l4x');
  if (moveList) {
    const moves = moveList.querySelectorAll('kwdb');
    isBlackToMove = (moves.length % 2 === 1);
  }

  return new Promise(resolve => {
    let attempts = 0;
    const maxAttempts = 5;

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
        const sideToMove = isBlackToMove ? 'b' : 'w';
        resolve(fen + ` ${sideToMove} - - 0 1`);
      } else {
        setTimeout(tryRead, 100);
      }
    }
    tryRead();
  });
}

function addFinalArrowToHistory() {
  const shapesSVG = document.querySelector('svg.cg-shapes');
  if (!shapesSVG) return;

  const lines = shapesSVG.querySelectorAll('line');
  if (lines.length === 0) return;

  const line = lines[lines.length - 1];

  let x1 = parseFloat(line.getAttribute('x1'));
  let y1 = parseFloat(line.getAttribute('y1'));
  let x2 = parseFloat(line.getAttribute('x2'));
  let y2 = parseFloat(line.getAttribute('y2'));

  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

  const from = coordsToSquare(x1, y1);
  const to = coordsToSquare(x2, y2);

  if (!from || !to || from === to) return;

  const key = `${from}-${to}`;
  if (lastArrows.has(key)) return;

  processNewArrow(from, to);
  lastArrows.add(key);
}

function coordsToSquare(x, y) {
  // Precise mapping for Lichess cg-shapes viewBox="-4 -4 8 8"
  // We add a small bias toward the center of the square for better edge handling
  const file = Math.floor(((x + 4) / 8) * 8);
  const rank = Math.floor(((y + 4) / 8) * 8);

  let f = Math.max(0, Math.min(7, file));
  let r = Math.max(0, Math.min(7, rank));

  if (isFlipped) {
    f = 7 - f;
    r = 7 - r;
  }

  return String.fromCharCode(97 + f) + (8 - r);
}

function processNewArrow(from, to) {
  if (!chess) return;

  const uci = from + to;
  let san = null;
  let isLegal = false;

  try {
    let move = chess.move(uci) ||
               chess.move(uci, { sloppy: true }) ||
               chess.move({ from, to, promotion: 'q' });

    if (move) {
      san = move.san;
      isLegal = true;
    }
  } catch (e) {
    console.log(`Move attempt failed for ${uci}:`, e.message);
  }

  if (isLegal) {
    moveHistory.push(san);
    fillChatInput();
    console.log(`Added legal move: ${san} (${from}→${to})`);
  } else {
    console.log(`Ignored illegal: ${from}→${to}`);
  }
}

initExtension();
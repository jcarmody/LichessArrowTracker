console.log("Lichess Arrow Tracker v8.3 loaded");

let chess = null;
let lastArrows = new Set();
let moveHistory = [];
let mouseButtonDown = false;
let lastKnownFEN = "";
let lastFENCheck = 0;
let isShiftPressed = false;

function getMyUsername() {
  const userTag = document.getElementById('user_tag');
  if (userTag) return userTag.textContent.trim().toLowerCase();
  return null;
}

function isSpectating() {
  const myUsername = getMyUsername();
  if (!myUsername) return true;

  const playerLinks = document.querySelectorAll('.player .user-link, .player-top .user-link, .player-bottom .user-link, .user-link');
  const playerNames = Array.from(playerLinks).map(el => el.textContent.trim().toLowerCase());

  return !playerNames.some(name => name.includes(myUsername));
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
  const moveNumber = Math.floor((moves.length + 1) / 2);
  const isBlackMove = (moves.length % 2 === 0);

  if (isBlackMove) {
    return `${moveNumber}..${lastMoveText}`;
  } else {
    return `${moveNumber}.${lastMoveText}`;
  }
}

function fillChatInput(newMove) {
  if (!newMove) return;

  const chatInput = document.querySelector('input.mchat__say, .mchat__say');
  const notesTextarea = document.querySelector('.mchat__note');

  // Detect active tab
  const activeTab = document.querySelector('.mchat__tab-active');
  const notesTabActive = activeTab && activeTab.classList.contains('note');

  const target = notesTabActive && notesTextarea ? notesTextarea : chatInput;
  if (!target) return;

  let currentText = target.value.trim();

  // If empty or doesn't look like our line, start fresh
  if (!currentText || !currentText.includes('(')) {
    const context = getLastRealMoveContext();
    let prefix = "";

    // Add /w ONLY when in normal chat room AND actually playing
    if (!notesTabActive) {
      const isWhisperInput = chatInput && chatInput.classList.contains('whisper');
      if (!isWhisperInput && !isSpectating()) {
        prefix = "/w ";
      }
    }

    currentText = prefix;
    if (context) currentText += `(${context}) `;
  }

  // Append new move cleanly
  if (currentText && !currentText.endsWith(' ')) currentText += ' ';
  if (currentText && !currentText.endsWith(', ') && !currentText.endsWith(') ')) {
    currentText += ', ';
  }
  currentText += newMove;

  target.focus();
  target.value = currentText;

  const event = new Event('input', { bubbles: true });
  target.dispatchEvent(event);

  console.log("Appended to", notesTabActive ? "Notes" : "Chat room", ":", currentText);
}

function initExtension() {
  if (typeof Chess === 'undefined') {
    console.error("❌ chess.js not loaded");
    return;
  }

  chess = new Chess();
  syncBoardToChess();

  console.log("Detected username:", getMyUsername() || "unknown");

  document.addEventListener('keydown', e => { if (e.key === 'Shift') isShiftPressed = true; });
  document.addEventListener('keyup',   e => { if (e.key === 'Shift') isShiftPressed = false; });

  document.addEventListener('mousedown', e => { if (e.button === 2) mouseButtonDown = true; });
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
      fillChatInput(""); // refresh full line
    }
  });

  console.log("✅ v8.3 ready — append mode (you can type freely)");
}

async function syncBoardToChess() {
  const fen = await getCurrentFEN();
  if (fen && chess) {
    try { chess.load(fen); lastKnownFEN = fen; } catch (e) {}
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
    moveHistory = [];
    lastArrows.clear();
    clearChatInput();
    syncBoardToChess();
    return;
  }

  getCurrentFEN().then(currentFEN => {
    if (currentFEN && currentFEN !== lastKnownFEN) {
      lastKnownFEN = currentFEN;
      syncBoardToChess();
    }
  });
}

// getCurrentFEN, addFinalArrowToHistory, coordsToSquare, processNewArrow remain the same as v8.2
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

  processNewArrow(from, to, isShiftPressed);
  lastArrows.add(key);
}

function coordsToSquare(x, y) {
  const file = Math.floor(((x + 4) / 8) * 8);
  const rank = Math.floor(((y + 4) / 8) * 8);

  let f = Math.max(0, Math.min(7, file));
  let r = Math.max(0, Math.min(7, rank));

  if (isFlipped) { f = 7 - f; r = 7 - r; }

  return String.fromCharCode(97 + f) + (8 - r);
}

function processNewArrow(from, to, isPlanning) {
  if (!chess) return;

  let san = null;

  try {
    if ((from === "e1" && (to === "g1" || to === "c1")) || 
        (from === "e8" && (to === "g8" || to === "c8"))) {
      san = (to[0] === 'g') ? "O-O" : "O-O-O";
    } else {
      let move = chess.move(from + to) || chess.move(from + to, { sloppy: true }) || chess.move({ from, to, promotion: 'q' });
      if (move) san = move.san;
    }
  } catch (e) {}

  if (!san) {
    try {
      const piece = chess.get(from);
      if (piece) {
        const p = piece.type.toUpperCase();
        const capture = chess.get(to) ? 'x' : '';
        san = (p === 'P' ? '' : p) + capture + to;
      } else {
        san = `${from}→${to}`;
      }
    } catch (_) {
      san = `${from}→${to}`;
    }
  }

  // Force move on board
  try {
    const piece = chess.get(from);
    if (piece) {
      chess.remove(from);
      chess.put(piece, to);
    }
  } catch (e) {}

  const cleanMove = san.replace(/[+#]/g, '');
  moveHistory.push(cleanMove);
  fillChatInput(cleanMove);

  console.log(`Appended: ${cleanMove} (${from}→${to})`);
}

initExtension();
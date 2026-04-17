console.log("Lichess Arrow Tracker v2.0 loaded");

// Load chess.js from CDN (lightweight, no engine)
const chessScript = document.createElement('script');
chessScript.src = 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/chess.min.js';
chessScript.onload = () => initExtension();
document.head.appendChild(chessScript);

let chess = null;
let lastArrows = new Set();           // To detect only new arrows
let isFlipped = false;

function initExtension() {
  if (typeof Chess === 'undefined') {
    console.error("chess.js failed to load");
    return;
  }

  chess = new Chess();   // Starts at starting position - we'll reset it properly soon

  // Initial board sync
  syncBoardToChess();

  // MutationObserver to watch for new arrows (SVG lines in chessground)
  const observer = new MutationObserver(() => {
    if (document.visibilityState === 'visible') {
      detectAndProcessArrows();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("✅ Arrow Tracker initialized with chess.js");
}

function syncBoardToChess() {
  const fen = getCurrentFEN();
  if (fen && chess) {
    try {
      chess.load(fen);
      console.log("Board synced. Current FEN:", fen);
    } catch (e) {
      console.warn("Failed to load FEN into chess.js", e);
    }
  }
}

function getCurrentFEN() {
  // Improved version of your original FEN builder
  const cgWrap = document.querySelector('.cg-wrap');
  if (!cgWrap) return null;

  isFlipped = cgWrap.classList.contains('orientation-black');

  const board = Array(8).fill().map(() => Array(8).fill(''));
  const pieces = document.querySelectorAll('piece');

  const boardRect = cgWrap.getBoundingClientRect();
  const squareSize = boardRect.width / 8;

  pieces.forEach(piece => {
    if (piece.classList.contains('ghost') || piece.classList.contains('fading')) return;

    const transform = piece.style.transform;
    if (!transform) return;

    const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    if (!match) return;

    let x = parseFloat(match[1]);
    let y = parseFloat(match[2]);

    const file = Math.floor((x + squareSize / 2) / squareSize);
    const rank = Math.floor((y + squareSize / 2) / squareSize);

    if (file < 0 || file > 7 || rank < 0 || rank > 7) return;

    const colorMatch = piece.className.match(/(white|black)/);
    const typeMatch = piece.className.match(/(king|queen|rook|bishop|knight|pawn)/);

    if (!colorMatch || !typeMatch) return;

    let p = typeMatch[1][0].toLowerCase(); // k,q,r,b,n,p
    if (colorMatch[1] === 'white') p = p.toUpperCase();

    // Apply flip for black orientation
    const displayRank = isFlipped ? 7 - rank : rank;
    const displayFile = isFlipped ? 7 - file : file;

    board[displayRank][displayFile] = p;
  });

  // Build FEN string
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

  return fen + (isFlipped ? ' b' : ' w') + ' - - 0 1';
}

function detectAndProcessArrows() {
  const arrows = document.querySelectorAll('svg line.arrow');
  if (!arrows.length) return;

  const currentArrowSet = new Set();

  arrows.forEach(arrow => {
    const x1 = parseFloat(arrow.getAttribute('x1'));
    const y1 = parseFloat(arrow.getAttribute('y1'));
    const x2 = parseFloat(arrow.getAttribute('x2'));
    const y2 = parseFloat(arrow.getAttribute('y2'));

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    const fromSquare = coordsToSquare(x1, y1);
    const toSquare = coordsToSquare(x2, y2);

    if (!fromSquare || !toSquare || fromSquare === toSquare) return;

    const key = `${fromSquare}-${toSquare}`;
    currentArrowSet.add(key);

    // Only process new arrows
    if (!lastArrows.has(key)) {
      processNewArrow(fromSquare, toSquare);
      lastArrows.add(key);
    }
  });

  // Clean up arrows that were removed
  lastArrows.forEach(oldKey => {
    if (!currentArrowSet.has(oldKey)) lastArrows.delete(oldKey);
  });
}

function coordsToSquare(x, y) {
  const cgWrap = document.querySelector('.cg-wrap');
  if (!cgWrap) return null;

  const rect = cgWrap.getBoundingClientRect();
  const squareSize = rect.width / 8;

  let file = Math.floor(x / squareSize);
  let rank = Math.floor(y / squareSize);

  if (isFlipped) {
    file = 7 - file;
    rank = 7 - rank;
  }

  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

  return String.fromCharCode(97 + file) + (8 - rank);
}

function processNewArrow(from, to) {
  if (!chess) return;

  try {
    // Try to make the move on our virtual board
    const move = chess.move({ from, to, promotion: 'q' }); // auto-promote to queen for now

    if (move) {
      const san = move.san;
      whisperMove(san);
      console.log(`Arrow ${from}-${to} → ${san}`);
    } else {
      // Illegal according to chess.js — still whisper raw for flexibility
      whisperMove(`${from}-${to}`);
      console.log(`Non-standard arrow ${from}→${to}`);
    }
  } catch (e) {
    console.warn("Move processing error:", e);
    whisperMove(`${from}→${to}`);
  }
}

function whisperMove(text) {
  const chatInput = document.querySelector('input.chat-text-input, textarea.chat-text-input');
  if (!chatInput) {
    console.log("Chat input not found. Move:", text);
    return;
  }

  // Focus and insert the move
  chatInput.focus();
  chatInput.value = text;

  // Trigger input event so Lichess recognizes it
  const event = new Event('input', { bubbles: true });
  chatInput.dispatchEvent(event);

  // Optional: auto-send with Enter (comment this out if you prefer manual send)
  // const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  // chatInput.dispatchEvent(enterEvent);
}

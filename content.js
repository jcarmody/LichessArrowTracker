console.log("🎯 Lichess Arrow Detector loaded");
var consoleMessage = "";
let isMouseDown = false;
window.cachedArrows = new Map();

document.addEventListener('pointerdown', () => isMouseDown = true, true);
document.addEventListener('pointerup', () => isMouseDown = false, true);


function myConsoleLog(message) {
    if (!consoleMessage.includes(message)) {
        console.log(message);
        consoleMessage += message;
    }
}

function coordsToSquare(x, y) {
  // Check if board is flipped (playing as black).  Only called from detectArrows()
  const cgWrap = document.querySelector('.cg-wrap');
  const isFlipped = cgWrap && cgWrap.classList.contains('orientation-black');
  
  if (isFlipped) {
    // When playing as Black, board is flipped - invert coordinates
    const file = 7 - Math.floor(x + 4);
    const rank = Math.floor(y + 4) + 1;
    if (file >= 0 && file <= 7 && rank >= 1 && rank <= 8) {
      return String.fromCharCode(97 + file) + rank;
    }
  } else {
    // Normal orientation (playing as White)
    const file = Math.floor(x + 4);
    const rank = 8 - Math.floor(y + 4);
    if (file >= 0 && file <= 7 && rank >= 1 && rank <= 8) {
      return String.fromCharCode(97 + file) + rank;
    }
  }
  return null;
}

function roundToNearestHalf(num) {
  return Math.round(num * 2) / 2;
}

function getFEN() {
  try {
    //const pieces = document.querySelectorAll('.main-board .cg-wrap piece');
    const board = Array(8).fill().map(() => Array(8).fill(''));
    
    // Check if board is flipped
    const cgWrap = document.querySelector('.cg-wrap');
    const isFlipped = cgWrap && cgWrap.classList.contains('orientation-black');
    myConsoleLog(`Playing as ${isFlipped ? 'Black' : 'White'}`);
    
    // Get board dimensions dynamically
    const boardElement = document.querySelector('.cg-wrap');
    if (!boardElement) {
      return null;
    }
    
    const boardRect = boardElement.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    myConsoleLog(squareSize);

    const allPieces = document.querySelectorAll('piece');

    const pieces = Array.from(allPieces).filter(piece => {
        const pieceRect = piece.getBoundingClientRect();
  
        // Check if piece is within board boundaries
        return pieceRect.left >= boardRect.left &&
             pieceRect.right <= boardRect.right &&
             pieceRect.top >= boardRect.top &&
             pieceRect.bottom <= boardRect.bottom;
    });
      
    pieces.forEach((piece) => {
      const classes = piece.className;
      // Skip ghost pieces
      if (classes.includes('ghost') || classes.includes('fading')) {
        return;
      }
      
      const colorMatch = classes.match(/(white|black)/);
      const pieceMatch = classes.match(/(king|queen|rook|bishop|knight|pawn)/);
      
      if (colorMatch && pieceMatch) {
        const color = colorMatch[1];
        const pieceType = pieceMatch[1];
        const transform = piece.style.transform;
        //console.log(`${color} ${pieceType} found`);
        
        if (transform) {
          const transformMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (transformMatch) {
            let x = parseFloat(transformMatch[1].replace('px', ''));
            let y = parseFloat(transformMatch[2].replace('px', ''));
            
            // Calculate file and rank based on board orientation
            let file, rank;
            
            if (isFlipped) {
              // When playing as black, coordinates are flipped
              file = 7 - Math.floor((x + squareSize / 2) / squareSize);
              rank = Math.floor((y + squareSize / 2) / squareSize);
            } else {
              // Normal orientation (playing as white)
              file = Math.floor((x + squareSize / 2) / squareSize);
              rank = 7 - Math.floor((y + squareSize / 2) / squareSize);
            }
            // Ensure coordinates are within bounds
            if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
              const pieceChar = pieceType === 'knight' ? 'n' :
                               pieceType === 'bishop' ? 'b' :
                               pieceType === 'rook' ? 'r' :
                               pieceType === 'queen' ? 'q' :
                               pieceType === 'king' ? 'k' :
                               pieceType === 'pawn' ? 'p' : '';
              
              const fenPiece = color === 'white' ? pieceChar.toUpperCase() : pieceChar;
              board[rank][file] = fenPiece;
              //myConsoleLog(`x: ${x}, y: ${y} translates to ${fenPiece} at file: ${file} and rank: ${rank}`);
            }
          }
        }
      }
    });
    
    // Convert to FEN
    let fen = '';
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        if (board[rank][file] === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += board[rank][file];
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) fen += '/';
    }
    myConsoleLog(`📋 FEN: ${fen}`);
    return fen + ' w - - 0 1';
    
  } catch (error) {
    console.log(`getFEN error ${error.name} ${error.message} ${error.stack}`);
    return null;
  }
}

function fenToBoard(fen) {
  const board = Array(8).fill().map(() => Array(8).fill(''));
  const position = fen.split(' ')[0];
  const ranks = position.split('/');
  
  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rank = ranks[rankIndex];
    let fileIndex = 0;
    
    for (let i = 0; i < rank.length; i++) {
      const char = rank[i];
      if (char >= '1' && char <= '8') {
        fileIndex += parseInt(char);
      } else {
        board[rankIndex][fileIndex] = char;
        fileIndex++;
      }
    }
  }
  
  return board;
}

function getPieceAt(board, square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  return board[rank][file];
}

function formatMove(fromSquare, toSquare, board, existingArrows = []) {
  // Apply previous arrows to get the current virtual board state
  const virtualBoard = applyArrows(board, existingArrows);
  
  const piece = getPieceAt(virtualBoard, fromSquare); // Use original board for the moving piece - NO!
  let targetPiece = getPieceAt(virtualBoard, toSquare); // Use virtual board for target
  
  myConsoleLog(`  Piece at ${fromSquare}: ${piece || 'empty'}`);
  myConsoleLog(`  Target at ${toSquare}: ${targetPiece || 'empty'}`);
  
  if (!piece || piece === '') {
    return `${fromSquare} → ${toSquare}`;
  }
  
  const pieceType = piece.toLowerCase();
  const isCapture = targetPiece && targetPiece !== '';
  
  if (pieceType === 'p') {
    if (isCapture) {
      const fromFile = fromSquare[0];
      const result = `${fromFile}x${toSquare}`;
      return result;
    } else {
      return toSquare;
    }
  }
  
  const pieceSymbol = pieceType === 'n' ? 'N' :
                     pieceType === 'b' ? 'B' :
                     pieceType === 'r' ? 'R' :
                     pieceType === 'q' ? 'Q' :
                     pieceType === 'k' ? 'K' : '';
  
  if (isCapture) {
    if(targetPiece.toLowerCase() === 'p') {targetPiece = toSquare;}
    const result = `${pieceSymbol}x${targetPiece}`; // was toSquare
    return result;
  } else {
    const result = pieceSymbol + toSquare;
    return result;
  }
}

function applyArrows(board, arrows) {
  const virtualBoard = board.map(row => [...row]);
  
  arrows.forEach(arrow => {
    const fromFile = arrow.from.charCodeAt(0) - 97;
    const fromRank = parseInt(arrow.from[1]) - 1;
    const toFile = arrow.to.charCodeAt(0) - 97;
    const toRank = parseInt(arrow.to[1]) - 1;
    //myConsoleLog(`from:${fromFile}, ${fromRank} - to:${toFile}, ${toRank}`);
    const piece = virtualBoard[fromRank][fromFile];
    if (piece && piece !== '') {
      virtualBoard[toRank][toFile] = piece;
      virtualBoard[fromRank][fromFile] = '';
    }
  });
  
  return virtualBoard;
}

function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  } catch (error) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  } catch (error) {
    // Silent fallback failure
  }
}

function postToGameChat(movesText) {
  try {
    const chatSelectors = [
      '.mchat__say',
      'input.mchat__say',
      'input[placeholder*="Chat"]',
      'input[placeholder*="chat"]', 
      '.mchat__say input',
      '.chat-input input',
      '#chat-input',
      '.round__chat input',
      'form.mchat input',
      '.rmchat input',
      '.chat input'
    ];
    
    let chatInput = null;
    
    for (const selector of chatSelectors) {
      const inputs = document.querySelectorAll(selector);
      
      if (inputs.length > 0) {
        for (const input of inputs) {
          const rect = input.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && !input.hidden;
          
          if (isVisible) {
            chatInput = input;
            break;
          }
        }
        if (chatInput) break;
      }
    }
    
    if (chatInput) {
      const chatMessage = movesText ? `/w ${movesText}` : '';
      
      chatInput.value = '';
      setTimeout(() => {
        chatInput.value = chatMessage;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        if (movesText) {
          chatInput.focus();
        }
      }, 50);
    }
  } catch (error) {
    // Silent failure
  }
}

function detectArrows() { // this happens a lot more frequently than when an arrow is drawn...
  if(isMouseDown) {
      return;
  }
  
  const lines = document.querySelectorAll('svg line');
  const arrows = [];
  
  lines.forEach((line, index) => {
    const markerEnd = line.getAttribute('marker-end');
    if (markerEnd && markerEnd.includes('arrowhead')) {
      const x1 = parseFloat(line.getAttribute('x1'));
      const y1 = parseFloat(line.getAttribute('y1'));
      const x2 = roundToNearestHalf(parseFloat(line.getAttribute('x2')));
      const y2 = roundToNearestHalf(parseFloat(line.getAttribute('y2')));
      const lineKey = `${x1},${y1}`;
      
      // Use cached coordinates if we've seen this line before
      let from, to;
      if (window.cachedArrows.has(lineKey)) {
        const cached = window.cachedArrows.get(lineKey);
        from = cached.from;
        to = cached.to;
        myConsoleLog(`Using cached: ${from} → ${to}`);
      } else {
        from = coordsToSquare(x1, y1);
        to = coordsToSquare(x2, y2);
        if (from && to) {
          window.cachedArrows.set(lineKey, { from, to });
          myConsoleLog(`Cached new: ${from} → ${to}`);
        }
      }
      
      if (from && to) {
        arrows.push({ from, to });
      }
    }
  });
  
  // Handle arrow clearing case
  if (arrows.length === 0 && window.lastArrowsString) {
    // Arrows were cleared - clear the chat input
    postToGameChat(''); // Empty string clears the chat
    window.lastArrowsString = null;
    consoleMessage = "";
    console.clear();
    return;
  }
      
  const currentArrowsString = JSON.stringify(arrows);
  if (isMouseDown || arrows.length === 0 || (!isMouseDown && currentArrowsString === window.lastArrowsString)) // Check for arrow changes FIRST, before calculating FEN
  {
    getFEN();
    return;
  }
  myConsoleLog(`${isMouseDown} ${currentArrowsString} ---- ${window.lastArrowsString}`);

  // Only NOW calculate FEN if arrows actually changed
  const fen = getFEN();
  if (!fen) {
    return;
  }
  
  myConsoleLog("📋 FEN: ", fen);
  
  const board = fenToBoard(fen);
  const moves = [];
  
  // Only process if we have arrows
  if (arrows.length > 0) {    
    arrows.forEach((arrow, index) => {
      const previousArrows = arrows.slice(0, index);
      const move = formatMove(arrow.from, arrow.to, board, previousArrows);
      moves.push(move);
      myConsoleLog(`🟢 Move ${index + 1}: ${arrow.from} → ${arrow.to} = ${move}`);
    });
    
    const movesText = moves.join(', ');
    myConsoleLog(`📋 Final result: ${movesText}`);
    copyToClipboard(movesText);
    postToGameChat(movesText);
    
    // Remember this arrow state
    window.lastArrowsString = currentArrowsString;
  }
}

function setup() {
  const observer = new MutationObserver(() => {
    clearTimeout(window.arrowTimeout);
    window.arrowTimeout = setTimeout(detectArrows, 0); // I used 0 ms delay because (I think) the delay causes me to miss the coordinates of a piece landing
  });
  
  const targets = [
    document.querySelector('.main-board'),
    document.querySelector('.cg-wrap'),
    document.body
  ].filter(Boolean);
  
  targets.forEach(target => {
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true
    });
  });

  detectArrows();
}

document.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  myConsoleLog(`🖱️ Mouse down - ctrl: ${e.ctrlKey}, meta: ${e.metaKey}`);
});

document.addEventListener('mouseup', (e) => {
  isMouseDown = false;
  myConsoleLog(`🖱️ Mouse up - ctrl: ${e.ctrlKey}, meta: ${e.metaKey}`);
});


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}

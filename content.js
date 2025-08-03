console.log("🎯 Lichess Arrow Detector loaded");

function coordsToSquare(x, y) {
  // Check if board is flipped (playing as black)
  const cgWrap = document.querySelector('.cg-wrap');
  const isFlipped = cgWrap && cgWrap.classList.contains('orientation-black');
  
  //console.log(`Coords: (${x},${y}), Board flipped: ${isFlipped}`);
  
  if (isFlipped) {
    // When playing as Black, board is flipped - invert coordinates
    const file = 7 - Math.floor(x + 4);
    const rank = Math.floor(y + 4) + 1;
    //console.log(`Flipped mapping: file=${file}, rank=${rank}`);
    if (file >= 0 && file <= 7 && rank >= 1 && rank <= 8) {
      return String.fromCharCode(97 + file) + rank;
    }
  } else {
    // Normal orientation (playing as White)
    const file = Math.floor(x + 4);
    const rank = 8 - Math.floor(y + 4);
    //console.log(`Normal mapping: file=${file}, rank=${rank}`);
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
    const pieces = document.querySelectorAll('piece');
    const board = Array(8).fill().map(() => Array(8).fill(''));
    
    // Check if board is flipped
    const cgWrap = document.querySelector('.cg-wrap');
    const isFlipped = cgWrap && cgWrap.classList.contains('orientation-black');
    
    // Get board dimensions dynamically
    const boardElement = document.querySelector('.cg-wrap');
    if (!boardElement) {
      return null;
    }
    
    const boardRect = boardElement.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    
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
        
        if (transform) {
          const transformMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (transformMatch) {
            const x = parseFloat(transformMatch[1].replace('px', ''));
            const y = parseFloat(transformMatch[2].replace('px', ''));
            
            // Calculate file and rank based on board orientation
            let file, rank;
            
            if (isFlipped) {
              // When playing as black, coordinates are flipped
              file = 7 - Math.round(x / squareSize);
              rank = 7 - Math.round(y / squareSize);
            } else {
              // Normal orientation (playing as white)
              file = Math.round(x / squareSize);
              rank = Math.round(y / squareSize);
            }
            
            if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
              const pieceChar = pieceType === 'knight' ? 'n' :
                               pieceType === 'bishop' ? 'b' :
                               pieceType === 'rook' ? 'r' :
                               pieceType === 'queen' ? 'q' :
                               pieceType === 'king' ? 'k' :
                               pieceType === 'pawn' ? 'p' : '';
              
              const fenPiece = color === 'white' ? pieceChar.toUpperCase() : pieceChar;
              board[rank][file] = fenPiece;
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
    
    return fen + ' w - - 0 1';
    
  } catch (error) {
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
  return board[7-rank][file];
}

function formatMove(fromSquare, toSquare, board, existingArrows = []) {
  //console.log(`🎯 formatMove: ${fromSquare} → ${toSquare}, existingArrows: ${existingArrows.length}`);
  
  // Apply previous arrows to get the current virtual board state
  const virtualBoard = applyArrows(board, existingArrows);
  
  const piece = getPieceAt(board, fromSquare); // Use original board for the moving piece
  const targetPiece = getPieceAt(virtualBoard, toSquare); // Use virtual board for target
  
  console.log(`  Piece at ${fromSquare}: ${piece || 'empty'}`);
  console.log(`  Target at ${toSquare}: ${targetPiece || 'empty'}`);
  
  if (!piece || piece === '') {
    //console.log(`  No piece found at ${fromSquare}`);
    return `${fromSquare} → ${toSquare}`;
  }
  
  const pieceType = piece.toLowerCase();
  const isCapture = targetPiece && targetPiece !== '';
  
  //console.log(`  Piece type: ${pieceType}, isCapture: ${isCapture}`);
  
  if (pieceType === 'p') {
    if (isCapture) {
      const fromFile = fromSquare[0];
      const result = `${fromFile}x${toSquare}`;
      //console.log(`  Pawn capture: ${result}`);
      return result;
    } else {
      //console.log(`  Pawn move: ${toSquare}`);
      return toSquare;
    }
  }
  
  const pieceSymbol = pieceType === 'n' ? 'N' :
                     pieceType === 'b' ? 'B' :
                     pieceType === 'r' ? 'R' :
                     pieceType === 'q' ? 'Q' :
                     pieceType === 'k' ? 'K' : '';
  
  if (isCapture) {
    const result = `${pieceSymbol}x${toSquare}`;
    //console.log(`  Piece capture: ${result}`);
    return result;
  } else {
    const result = pieceSymbol + toSquare;
    //console.log(`  Piece move: ${result}`);
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
    
    const piece = virtualBoard[7-fromRank][fromFile];
    if (piece && piece !== '') {
      virtualBoard[7-toRank][toFile] = piece;
      virtualBoard[7-fromRank][fromFile] = '';
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

function detectArrows() {
  //console.log("🔍 detectArrows called");
  
  const fen = getFEN();
  if (!fen) {
    //console.log("❌ No FEN found");
    return;
  }
  
  //console.log("📋 FEN:", fen);
  
  const board = fenToBoard(fen);
  const lines = document.querySelectorAll('svg line');
  const arrows = [];
  const moves = [];
  
  //console.log(`🔍 Found ${lines.length} SVG lines`);
  
  lines.forEach((line) => {
    const markerEnd = line.getAttribute('marker-end');
    if (markerEnd && markerEnd.includes('arrowhead')) {
      const x1 = parseFloat(line.getAttribute('x1'));
      const y1 = parseFloat(line.getAttribute('y1'));
      const x2 = roundToNearestHalf(parseFloat(line.getAttribute('x2')));
      const y2 = roundToNearestHalf(parseFloat(line.getAttribute('y2')));
      const from = coordsToSquare(x1, y1);
      const to = coordsToSquare(x2, y2);
      
      if (from && to) {
        console.log(`Arrow detected: ${from} → ${to}`);
        arrows.push({ from, to });
      } else {
        console.log(`Arrow rejected: ${from} → ${to} (null coordinates)`);
      }
    }
  });
  
  //console.log(`🎯 Total arrows: ${arrows.length}`);
  
  // Only process if we have arrows and they've changed
  const currentArrowsString = JSON.stringify(arrows);
  if (arrows.length > 0 && currentArrowsString !== window.lastArrowsString) {
    //console.log("🔄 Processing arrows for moves");
    
    arrows.forEach((arrow, index) => {
      const previousArrows = arrows.slice(0, index);
      const move = formatMove(arrow.from, arrow.to, board, previousArrows);
      moves.push(move);
      console.log(`🟢 Move ${index + 1}: ${arrow.from} → ${arrow.to} = ${move}`);
    });
    
    const movesText = moves.join(', ');
    console.log(`📋 Final result: ${movesText}`);
    copyToClipboard(movesText);
    postToGameChat(movesText);
    
    // Remember this arrow state
    window.lastArrowsString = currentArrowsString;
  } else if (arrows.length === 0 && window.lastArrowsString) {
    // Arrows were cleared - clear the chat input
    //console.log("🧹 Clearing arrows and chat");
    postToGameChat(''); // Empty string clears the chat
    window.lastArrowsString = null;
  } else {
    //console.log("⏭️ Arrows unchanged, skipping");
  }
}

function setup() {
  const observer = new MutationObserver(() => {
    clearTimeout(window.arrowTimeout);
    window.arrowTimeout = setTimeout(detectArrows, 100);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
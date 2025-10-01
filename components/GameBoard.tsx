"use client";

import React, { useState, useMemo } from "react";

type Player = "X" | "O" | null;
type Board = Player[];

interface GameBoardProps {
  roomId: string;
  currentUser: string;
}

export default function GameBoard({ roomId, currentUser }: GameBoardProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<"X" | "O">("X");

  // Note: currentUser will be used for multiplayer features in the future
  console.log("Game started in room:", roomId, "by user:", currentUser);

  // Check for winner using mathematical patterns (memoized to avoid recalculation)
  const checkWinner = useMemo(() => {
    return (squares: Board): Player => {
      const size = 3; // 3x3 grid

      // Check rows: positions (i*3, i*3+1, i*3+2) for i = 0,1,2
      for (let row = 0; row < size; row++) {
        const startIndex = row * size;
        if (
          squares[startIndex] &&
          squares[startIndex] === squares[startIndex + 1] &&
          squares[startIndex] === squares[startIndex + 2]
        ) {
          return squares[startIndex];
        }
      }

      // Check columns: positions (j, j+3, j+6) for j = 0,1,2
      for (let col = 0; col < size; col++) {
        if (
          squares[col] &&
          squares[col] === squares[col + size] &&
          squares[col] === squares[col + 2 * size]
        ) {
          return squares[col];
        }
      }

      // Check main diagonal: positions (0, 4, 8) - formula: i*(size+1) for i = 0,1,2
      if (
        squares[0] &&
        squares[0] === squares[size + 1] &&
        squares[0] === squares[2 * (size + 1)]
      ) {
        return squares[0];
      }

      // Check anti-diagonal: positions (2, 4, 6) - formula: (i+1)*(size-1) for i = 0,1,2
      if (
        squares[size - 1] &&
        squares[size - 1] === squares[2 * (size - 1)] &&
        squares[size - 1] === squares[3 * (size - 1)]
      ) {
        return squares[size - 1];
      }

      return null;
    };
  }, []);

  // Derive game state using useMemo to avoid duplicate calculations
  const gameState = useMemo(() => {
    const winner = checkWinner(board);
    const isDraw = !winner && board.every((square) => square !== null);
    const isGameOver = winner || isDraw;

    let status: string;
    if (winner) {
      status = `Player ${winner} wins!`;
    } else if (isDraw) {
      status = "It's a draw!";
    } else {
      status = `Player ${currentPlayer}'s turn`;
    }

    return {
      winner,
      isDraw,
      isGameOver,
      status,
    };
  }, [board, currentPlayer, checkWinner]);

  // Handle square click
  const handleSquareClick = (index: number) => {
    // Prevent moves if game is over or square is occupied
    if (board[index] || gameState.isGameOver) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    // Only toggle player if game is not over after this move
    // The gameState will be recalculated automatically via useMemo
    const nextPlayer = currentPlayer === "X" ? "O" : "X";
    setCurrentPlayer(nextPlayer);
  };

  // Reset game
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer("X");
  };

  // Render square
  const renderSquare = (index: number) => {
    const isDisabled = gameState.isGameOver || board[index] !== null;

    return (
      <button
        key={index}
        className={`w-16 h-16 sm:w-20 sm:h-20 border-2 border-gray-400 text-2xl sm:text-3xl font-bold
          hover:bg-gray-100 transition-colors duration-200
          ${board[index] === "X" ? "text-blue-600" : "text-red-600"}
          ${gameState.isGameOver ? "cursor-not-allowed" : "cursor-pointer"}
        `}
        onClick={() => handleSquareClick(index)}
        disabled={Boolean(isDisabled)}
        type="button"
      >
        {board[index]}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 bg-white rounded-lg shadow-lg max-w-sm mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800">
        Tic Tac Toe
      </h2>

      {/* Game Status */}
      <div className="mb-4 text-center">
        <p
          className={`text-base sm:text-lg font-semibold ${
            gameState.winner ? "text-green-600" : "text-gray-700"
          }`}
        >
          {gameState.status}
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Room: {roomId}</p>
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-1 mb-4 sm:mb-6 bg-gray-300 p-2 rounded-lg">
        {Array(9)
          .fill(null)
          .map((_, index) => renderSquare(index))}
      </div>

      {/* Game Controls */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
        <button
          onClick={resetGame}
          className="px-4 sm:px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
            transition-colors duration-200 font-medium text-sm sm:text-base"
        >
          New Game
        </button>

        {gameState.isGameOver && (
          <div
            className="flex items-center justify-center px-4 py-2 bg-green-100 text-green-800
            rounded-lg border border-green-300 text-sm sm:text-base"
          >
            Game Over!
          </div>
        )}
      </div>

      {/* Game Stats */}
      <div className="mt-4 text-center text-xs sm:text-sm text-gray-600">
        <p>
          Current Player:{" "}
          <span
            className={`font-bold ${
              currentPlayer === "X" ? "text-blue-600" : "text-red-600"
            }`}
          >
            {currentPlayer}
          </span>
        </p>
      </div>
    </div>
  );
}
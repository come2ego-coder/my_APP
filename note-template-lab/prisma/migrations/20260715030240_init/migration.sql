-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "cutLabel" TEXT NOT NULL,
    "cutDescription" TEXT NOT NULL,
    "analysisJson" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "userInput" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

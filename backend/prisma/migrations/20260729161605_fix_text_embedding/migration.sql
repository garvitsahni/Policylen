-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "insurerName" TEXT,
    "sumInsured" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedClause" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clauseType" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "fieldsJson" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,

    CONSTRAINT "ExtractedClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clauseId" TEXT,
    "taxonomyId" TEXT NOT NULL,
    "colorType" TEXT NOT NULL,
    "severity" TEXT,
    "explanation" TEXT NOT NULL,
    "rupeeAtRisk" INTEGER,
    "sourceExcerpt" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyHealthScore" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "settlementRatio" DOUBLE PRECISION,

    CONSTRAINT "PolicyHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" text NOT NULL,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "groundedInDocument" BOOLEAN,
    "citedClauseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyHealthScore_documentId_key" ON "PolicyHealthScore"("documentId");

-- AddForeignKey
ALTER TABLE "ExtractedClause" ADD CONSTRAINT "ExtractedClause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyHealthScore" ADD CONSTRAINT "PolicyHealthScore_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

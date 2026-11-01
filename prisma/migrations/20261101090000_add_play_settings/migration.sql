-- CreateTable
CREATE TABLE "play_settings" (
    "owner_id" TEXT NOT NULL PRIMARY KEY,
    "sound_on" BOOLEAN NOT NULL DEFAULT true,
    "voice_on" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT '',
    "challenge" TEXT NOT NULL DEFAULT 'gentle'
);

-- CreateTable
CREATE TABLE "game_choices" (
    "owner_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'normal',
    "favourite" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("owner_id", "game_id")
);

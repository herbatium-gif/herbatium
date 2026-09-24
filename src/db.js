const { PrismaClient } = require("@prisma/client");

// O singură instanță Prisma, reutilizată în toată aplicația.
const prisma = new PrismaClient();

module.exports = prisma;

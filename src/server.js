require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');

const api = require('./routes/index.js'); // Rotas principais (index.js)
const salasRouter = require('./routes/salas'); // 

const { errorHandler } = require('./middleware/error');
const { sequelize } = require('./models');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.use(express.json());
app.use(morgan('dev'));

app.use("/public", express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../public/pages")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pages/index.html"));
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/teste-direto', (req, res) => {
  res.status(200).json({ message: "O TESTE DIRETO NO SERVER.JS FUNCIONOU!" });
});

app.use('/api', api); // Rotas existentes
app.use('/api', salasRouter); 

const gamesRouter = require('./routes/games');
const playersRouter = require('./routes/players');
app.use('/api', gamesRouter);
app.use('/api/players', playersRouter);

const resultsRouter = require('./routes/results.routes');
app.use('/api/results', resultsRouter);


app.use(errorHandler);

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB conectado.');
    //await sequelize.sync({ alter: true }); // Em produção, use migrations
    //console.log('✅ Modelos sincronizados com o DB.');
  } catch (err) {
    console.error('❌ Falha ao conectar no DB:', err);
  }
})();


const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' },
  pingTimeout: 60000, // 60 segundos - tempo para considerar desconexão após ping
  pingInterval: 25000, // 25 segundos - intervalo entre pings
  transports: ['websocket', 'polling'], // Permite fallback para polling se websocket falhar
  allowEIO3: true // Compatibilidade com versões antigas
});


require('./socket/gameSocket')(io);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

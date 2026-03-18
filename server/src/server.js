const app = require('./app');
const {port} = require('./config');
const PORT = process.env.PORT || port || 3000;
app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));

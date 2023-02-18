const { Client, LocalAuth } = require('whatsapp-web.js');
const { Message, ClientInfo, Buttons, List } = require('whatsapp-web.js/src/structures');
const express = require('express');
const socketIO = require('socket.io')
const qrcode = require('qrcode')
const http = require('http')
const fs = require('fs');
const { 
  v1: uuidv1,
} = require('uuid');
const app = express();
const server = http.createServer(app);

const dataDir = `wa-data`
const clients = [];

const io = socketIO(server, { 
    cors: { 
        origin: "http://localhost:3000", methods: ["GET", "POST"], transports: ['websocket', 'polling'], credentials: true 
    }, 
    allowEIO3: true 
});

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

app.set('view engine', 'pug')

app.get('/', async(req, res, next) => {
    var response = getDirectories(dataDir)
    res.render('index', {lists: response})
})

app.get('/create', (req, res, next) => {
    var nc_uuid = uuidv1();
    if (!fs.existsSync(dataDir+'/'+nc_uuid)) {
        fs.mkdirSync(dataDir+'/'+nc_uuid);
    }

    res.redirect('/')
})

app.post('/create', (req, res, next) => {
    var nc_uuid = req.body.wanumber;
    if (!fs.existsSync(dataDir+'/'+nc_uuid)) {
        fs.mkdirSync(dataDir+'/'+nc_uuid);
    }

    res.redirect('/')
})

app.get('/delete/:uuid', (req, res, next) => {
    var nd_uuid = req.params.uuid;

    if(list_client[nd_uuid] === undefined){
        console.log("isexist")
    }else{
        fs.rmSync(dataDir+'/'+nd_uuid, { recursive: true, force: true });
    }

    res.redirect('/');    
    
})

app.get('/connect/:uuid', (req, res, next) => {
    var uuid = req.params.uuid;
    res.render('connect', {uuid: uuid})
});

function createWaClient(uuid) {
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: 'wa-data/'+uuid
        }),
        puppeteer: {
            args: ['--no-sandbox'],
        },
        qrMaxRetries: 3,
    });

    client.initialize();

    return client;
}

// socket io
var date = new Date();
var list_client = [];

var manager = io.of("/wha-room").on('connection', function (socket) {
    var client
    var myroomid

    socket.on("join", function(roomid){
        
        //console.log(list_client.length)

        if(list_client[roomid] === undefined){
            socket.join(roomid);
            client = createWaClient(roomid);    
            
            manager.to(roomid).emit('message', "connecting...");

            client.on('qr', async (qr) => {
                var dataurl = await qrcode.toDataURL(qr);
                manager.to(roomid).emit('message', "Receive QR Code for "+ roomid);
                manager.to(roomid).emit('qr code', dataurl);
            })

            client.on('ready', async() => {
                let state = await client.getState()
                if (state === 'TIMEOUT'){
                    //console.log("TIMEOUT REACHED")
                } else {
                    //console.log("STATE: ", state)
                    if(state == "CONNECTED"){
                        list_client[roomid] = client;
                    }
                }

                socket.emit('ready', 'is Ready')
                socket.emit('message', 'is Ready and Connect to '+ client.info.wid.user)
            });

            client.on('authenticated', (session) => {    
                socket.emit('authenticated', 'is authenticated')
                socket.emit('message', 'is authenticated')
            });

            client.on('disconnected', (reason) => {
                socket.emit('disconnected', 'is disconnected')
                socket.emit('message', 'is disconnected : ')

                delete list_client[roomid];
            });

        }else{
            //client = list_client[roomid]

            socket.emit('ready', 'is Ready')
            //client.isRegisteredUser(myroomid).then(c=> console.log(c)).catch(err => console.log(err))
            //client.getNumberId(myroomid).then(c=> console.log(c)).catch(err => console.log(err))
            socket.emit('message', 'is Ready')
        }
    });
});

//send msg
app.post('/send-msg', async(req, res) => {
    var ok = true;
    var clientID = req.header('clientID'); 
    var client = list_client[clientID];

    console.log(client)
    
    if(client === undefined){
        client = createWaClient(clientID)

        client.on('qr', async (qr) => {
            console.log("QR Receive ", clientID);
            res.status(200).json({
                status: false,
                response: "client disconnected",
            })
            client.destroy();
        })


        client.on('ready', async() => {
            let state = await client.getState()
            if (state === 'TIMEOUT'){
                console.log("TIMEOUT REACHED")
                res.status(200).json({
                    status: false,
                    response: state,
                })
            } else {
                console.log("STATE: ", state)
                if(state == "CONNECTED"){
                    list_client[clientID] = client;
                    fireMsg(req, res, client)
                }else{
                    res.status(200).json({
                        status: false,
                        response: response,
                    })
                }
            }
        });
    }else{
        fireMsg(req, res, client);
    }
})


function fireMsg(req, res, client){
    //console.log(req.body)
    //console.log(res)
    var number = req.body.number;
    number = "62" + number.substring(1, number.length-1) + "@c.us";
    //console.log(number);
    var message = req.body.message;

    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response,
        })
    }).catch(err => {
        //console.log(err)
        res.status(500).json({
            status: false,
            response: err.message(),
        })
    });
}

server.listen(3000, function(){
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    console.log("running at *:"+3000)
})
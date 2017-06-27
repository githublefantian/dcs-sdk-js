const config=require("./dcs_config.json");
let child_process=require("child_process");
const BufferManager=require("./wakeup/buffermanager").BufferManager;
let rec_cmd=config.rec_cmd+' -t wav -r44100 -b32 -c2 -';
let convert_cmd=config.sox_cmd+' -t wav -r44100 -b32 -c2 - -t s16 -r16000 -b16 -c1 -';

function Recorder(){
    this.rec_process=null;
    this.convert_process=null;
}

module.exports=Recorder;

Recorder.prototype.start=function(){
    if(!this.rec_process){
        this.rec_process=child_process.spawn(rec_cmd.split(" ")[0],rec_cmd.split(" ").slice(1),
                {   
                    env:config.rec_env,
                    stdio:['ignore', 'pipe', 'pipe']
                }
                );

        this.convert_process=child_process.spawn(convert_cmd.split(" ")[0],convert_cmd.split(" ").slice(1),
                {stdio:['pipe', 'pipe', 'pipe']}
                );
        this.rec_process.stdout.pipe(this.convert_process.stdin);
        console.log("rec start");
        this.buffer_manager=new BufferManager();
        var MAX_BUFFER_SIZE=16000*16*1/8 * 8; //8s的pcm流
        var MIN_BUFFER_SIZE=16000*16*1/8 * 5; //5s的pcm流
        //缓存的pcm永远在5-8s之间
        this.convert_process.stdout.on("data",(chunk)=>{
            this.buffer_manager.add(chunk);
            if(this.buffer_manager.size()>MAX_BUFFER_SIZE){
                this.buffer_manager.delete(MAX_BUFFER_SIZE-MIN_BUFFER_SIZE);
            }
        });
        this.rec_process.stderr.pipe(process.stderr);
    }
    return this;
};

Recorder.prototype.getLatestBuffers=function(timeInMs){
    var length=32*parseInt(timeInMs,10)//1ms数据是32字节
    var bufSize=this.buffer_manager.size();
    if(bufSize>length){
        return this.buffer_manager.slice(bufSize-length,length);
    }else{
        return this.buffer_manager.slice(0);
    }
};

Recorder.prototype.stop=function(){
    if(this.rec_process){
        this.rec_process.kill("SIGINT");
    }
    if(this.convert_process){
        this.convert_process.kill("SIGINT");
    }
    this.rec_process=null;
    this.convert_process=null;
    console.log("rec end");
    return this;
};


Recorder.prototype.out=function(){
    if(this.convert_process){
        return this.convert_process.stdout;
    }
};

Recorder.prototype.stderr=function(){
    if(this.rec_process){
        return this.rec_process.stderr;
    }
};
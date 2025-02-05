//

// FileReader

//

// http://www.w3.org/TR/FileAPI/#dfn-filereader

// https://developer.mozilla.org/en/DOM/FileReader

import fs from "node:fs";
import { EventEmitter } from "node:events";


function doop(fn: any, args: any, context?: any) {

    if ('function' === typeof fn) {

        fn.apply(context, args);

    }

}


function toDataUrl(data: any, type: any) {

    // var data = this.result;

    var dataUrl = 'data:';


    if (type) {

        dataUrl += type + ';';

    }


    if (/text/i.test(type)) {

        dataUrl += 'charset=utf-8,';

        dataUrl += data.toString('utf8');

    } else {

        dataUrl += 'base64,';

        dataUrl += data.toString('base64');

    }


    return dataUrl;

}


function mapDataToFormat(file: any, data: any, format: any, encoding: any) {

    // var data = this.result;


    switch (format) {

        case 'buffer':

            return data;

            break;

        case 'binary':

            return data.toString('binary');

            break;

        case 'dataUrl':

            return toDataUrl(data, file.type);

            break;

        case 'text':

            return data.toString(encoding || 'utf8');

            break;

    }

}


export class FileReader {

    EMPTY = 0;

    LOADING = 1;

    DONE = 2;


    error = undefined;         // Read only

    readyState = this.EMPTY;   // Read only

    result = undefined;        // Road only

    emitter = new EventEmitter;

    file: any;

    nodeChunkedEncoding = false;

    readState: any;

    onloadstart: any;

    onprogress: any;

    onerror: any;

    onload: any;

    onloadend: any;

    onabort: any;


    constructor() {
        this.emitter.on('abort', () => {

            this.readyState = this.DONE;

        });
    }



    createFileStream() {

        var stream = new EventEmitter(),

            chunked = this.nodeChunkedEncoding;


        // attempt to make the length computable

        if (!this.file.size && chunked && this.file.path) {

            fs.stat(this.file.path, (err, stat) => {

                this.file.size = stat.size;

                this.file.lastModifiedDate = stat.mtime;

            });

        }



        // The stream exists, do nothing more

        if (this.file.stream) {

            return;

        }



        // Create a read stream from a buffer

        if (this.file.buffer) {

            process.nextTick(() => {

                stream.emit('data', this.file.buffer);

                stream.emit('end');

            });

            this.file.stream = stream;

            return;

        }



        // Create a read stream from a file

        if (this.file.path) {

            // TODO url

            if (!chunked) {

                fs.readFile(this.file.path, (err, data) => {

                    if (err) {

                        stream.emit('error', err);

                    }

                    if (data) {

                        stream.emit('data', data);

                        stream.emit('end');

                    }

                });


                this.file.stream = stream;

                return;

            }


            // TODO don't duplicate this code here,

            // expose a method in File instead

            this.file.stream = fs.createReadStream(this.file.path);

        }

    }

    // Map `error`, `progress`, `load`, and `loadend`

    mapStreamToEmitter(format: any, encoding: any) {

        let stream = this.file.stream;
        let buffers: any[] = [];
        let chunked = this.nodeChunkedEncoding;


        (buffers as any).dataLength = 0;


        stream.on('error', (err: any) => {

            if (this.DONE === this.readyState) {

                return;

            }


            this.readyState = this.DONE;

            this.error = err;

            this.emitter.emit('error', err);

        });


        stream.on('data', (data: any) => {

            if (this.DONE === this.readyState) {

                return;

            }


            (buffers as any).dataLength += data.length;

            buffers.push(data);


            this.emitter.emit('progress', {

                // fs.stat will probably complete before this

                // but possibly it will not, hence the check

                lengthComputable: (!isNaN(this.file.size)) ? true : false,

                loaded: (buffers as any).dataLength,

                total: this.file.size

            });


            this.emitter.emit('data', data);

        });


        stream.on('end', () => {

            if (this.DONE === this.readyState) {

                return;

            }


            var data;


            if (buffers.length > 1) {

                data = Buffer.concat(buffers);

            } else {

                data = buffers[0];

            }


            this.readyState = this.DONE;

            this.result = mapDataToFormat(this.file, data, format, encoding);

            this.emitter.emit('load', {

                target: {

                    // non-standard

                    nodeBufferResult: data,

                    result: this.result

                }

            });


            this.emitter.emit('loadend');

        });

    }


    mapUserEvents() {

        this.emitter.on('start', () => {

            doop(this.onloadstart, arguments);

        });

        this.emitter.on('progress', () => {

            doop(this.onprogress, arguments);

        });

        this.emitter.on('error', err => {

            // TODO translate to FileError

            if (this.onerror) {

                this.onerror(err);

            } else {

                if (!(this.emitter.listeners as any).error ||
                    !(this.emitter.listeners as any).error.length) {

                    throw err;

                }

            }

        });

        this.emitter.on('load', () => {

            doop(this.onload, arguments);

        });

        this.emitter.on('end', () => {

            doop(this.onloadend, arguments);

        });

        this.emitter.on('abort', () => {

            doop(this.onabort, arguments);

        });

    }




    private readFile(
        _file: any,
        format: 'buffer' | 'binary' | 'dataUrl' | 'text',
        encoding?: any) {
        if (!_file || !this.file.name || !(this.file.path || this.file.stream || this.file.buffer)) {
            throw new Error("cannot read as File: " + JSON.stringify(_file));
        }

        if (0 !== this.readyState) {
            console.log("already loading, request to change format ignored");
            return;
        }


        // 'process.nextTick' does not ensure order, (i.e. an fs.stat queued later may return faster)

        // but `onloadstart` must come before the first `data` event and must be asynchronous.

        // Hence we waste a single tick waiting

        process.nextTick(() => {

            this.readyState = this.LOADING;

            this.emitter.emit('loadstart');

            this.createFileStream();

            this.mapStreamToEmitter(format, encoding);

            this.mapUserEvents();

        });

    }



    abort = () => {

        if (this.readState == this.DONE) {

            return;

        }

        this.readyState = this.DONE;

        this.emitter.emit('abort');

    };




    // 

    public readAsArrayBuffer = (file: any) => {

        this.readFile(file, 'buffer');

    };

    public readAsBinaryString = (file: any) => {

        this.readFile(file, 'binary');

    };

    public readAsDataURL = (file: any) => {

        this.readFile(file, 'dataUrl');

    };

    public readAsText = (file: any, encoding: any) => {

        this.readFile(file, 'text', encoding);

    };


    addEventListener = (on: any, callback: any) => {

        this.emitter.on(on, callback);

    };

    removeEventListener = (callback: any) => {

        // this.emitter.removeListener(callback as any);

    }

    dispatchEvent = (on: any) => {

        this.emitter.emit(on);

    }

    on() {
        this.emitter.on.apply(this.emitter, arguments as any);
    }

    setNodeChunkedEncoding = (val: any) => {

        this.nodeChunkedEncoding = val;

    };

}


export default FileReader;


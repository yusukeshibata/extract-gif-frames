import { parseGIF, Stream } from './libgif'

export default class GIFParser {
  constructor(url) {
    this._url = url
    this._frames = []
  }
  parse() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      try {
        const req = new XMLHttpRequest()
        req.open('GET', this._url, true)
        req.responseType = 'arraybuffer'
        req.onerror = err => console.log(err)
        req.onload = evt => {
          const arrayBuffer = req.response
          const byteArray = new Uint8Array(arrayBuffer)
          const stream = new Stream(byteArray)
          parseGIF(stream, {
            hdr: this.onHeader,
            gce: this.onGCE,
            img: this.onImg,
            eof: this.onEOF
          })
        }
        req.send()
      } catch(err) {
        reject(err)
      }
    })
  }
  onEOF = () => {
    this.pushFrame()
    this._resolve(this._frames)
  }
  onImg = (img) => {
    if(!this._frame) this._frame = this._canvas.getContext('2d');
    var currIdx = this._frames.length;

    //ct = color table, gct = global color table
    var ct = img.lctFlag ? img.lct : this._header.gct; // TODO: What if neither exists?

    /*
            Disposal method indicates the way in which the graphic is to
            be treated after being displayed.

            Values :    0 - No disposal specified. The decoder is
                            not required to take any action.
                        1 - Do not dispose. The graphic is to be left
                            in place.
                        2 - Restore to background color. The area used by the
                            graphic must be restored to the background color.
                        3 - Restore to previous. The decoder is required to
                            restore the area overwritten by the graphic with
                            what was there prior to rendering the graphic.

                            Importantly, "previous" means the frame state
                            after the last disposal of method 0, 1, or 2.
                            */
    if (currIdx > 0) {
      if (this._lastDisposalMethod === 3) {
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        if (this._disposalRestoreFromIdx !== null) {
          this._frame.putImageData(this._frames[this._disposalRestoreFromIdx].data, 0, 0);
        } else {
          this._frame.clearRect(this._lastImg.leftPos, this._lastImg.topPos, this._lastImg.width, this._lastImg.height);
        }
      } else {
        this._disposalRestoreFromIdx = currIdx - 1;
      }

      if (this._lastDisposalMethod === 2) {
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        this._frame.clearRect(this._lastImg.leftPos, this._lastImg.topPos, this._lastImg.width, this._lastImg.height);
      }
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //Get existing pixels for img region after applying disposal method
    var imgData = this._frame.getImageData(img.leftPos, img.topPos, img.width, img.height);

    //apply color table colors
    img.pixels.forEach((pixel, i) => {
      // imgData.data === [R,G,B,A,R,G,B,A,...]
      if (pixel !== this._transparency) {
        imgData.data[i * 4 + 0] = ct[pixel][0];
        imgData.data[i * 4 + 1] = ct[pixel][1];
        imgData.data[i * 4 + 2] = ct[pixel][2];
        imgData.data[i * 4 + 3] = 255; // Opaque.
      }
    });

    this._frame.putImageData(imgData, img.leftPos, img.topPos);
    
    this._lastImg = img;
  }
  onHeader = (header) => {
    this._header = header
    this._canvas = document.createElement('canvas')
    this._canvas.width = header.width
    this._canvas.height= header.height
  }
  pushFrame() {
    if(!this._frame) return;
    this._frames.push({
      data: this._frame.getImageData(0, 0, this._header.width, this._header.height),
      delay: this._delay
    });
  }
  onGCE = (gce) => {
    // pushFrame
    this.pushFrame()

    this._lastDisposalMethod = this._disposalMethod;
    this._transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
    this._delay = gce.delayTime;
    this._disposalMethod = gce.disposalMethod;
  }
}
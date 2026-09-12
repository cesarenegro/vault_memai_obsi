import fs from 'fs';
import path from 'path';
import koffi from 'koffi';

// Descriptor-relative POSIX operations: never resolve descendant paths from cwd.
// Darwin dirent layout is defined in the Xcode SDK sys/dirent.h (64-bit inode ABI).
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('Vault core requires macOS or Linux');
const darwin = process.platform === 'darwin';
const libc = koffi.load(darwin ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6');
const openat = libc.func('int openat(int dirfd, const char *name, int flags, ...)');
const mkdirat = libc.func('int mkdirat(int dirfd, const char *name, unsigned int mode)');
const fdopendir = libc.func('void *fdopendir(int fd)');
const readdir = libc.func(darwin && process.arch === 'x64' ? 'readdir$INODE64' : 'readdir', 'void *', ['void *']);
const unlinkat = libc.func('int unlinkat(int fd, const char *name, int flags)');
const renameExclusive = libc.func(darwin ? 'int renameatx_np(int fromfd, const char *from, int tofd, const char *to, unsigned int flags)' : 'int renameat2(int fromfd, const char *from, int tofd, const char *to, unsigned int flags)');
const renameReplace = libc.func('int renameat(int fromfd, const char *from, int tofd, const char *to)');
const closedir = libc.func('int closedir(void *dir)');
const errnoPtr = libc.func(darwin ? 'int *__error(void)' : 'int *__errno_location(void)');
const errno = () => koffi.decode(errnoPtr(), 'int') as number;
function failure(operation: string): Error { return Object.assign(new Error(`${operation} failed (errno ${errno()})`), { errno: errno() }); }
function component(name: string) { if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\0')) throw new Error('Unsafe path component'); }
const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;

export class SafeDir {
  constructor(readonly fd: number) {}
  static open(root: string): SafeDir { return new SafeDir(fs.openSync(fs.realpathSync(root), flags | fs.constants.O_DIRECTORY)); }
  close() { fs.closeSync(this.fd); }
  open(name: string, directory = false): number {
    component(name);
    const fd = openat(this.fd, name, flags | (directory ? fs.constants.O_DIRECTORY : 0), 'unsigned int', 0) as number;
    if (fd < 0) throw failure(`Open ${name} (symlinks are not allowed)`);
    return fd;
  }
  dir(name: string): SafeDir { return new SafeDir(this.open(name, true)); }
  names(): string[] {
    const fd = openat(this.fd, '.', flags | fs.constants.O_DIRECTORY, 'unsigned int', 0) as number;
    if (fd < 0) throw failure('Open directory');
    const stream = fdopendir(fd);
    if (!stream) { fs.closeSync(fd); throw failure('Read directory'); }
    const names: string[] = [];
    try {
      while (true) {
        koffi.encode(errnoPtr(), 'int', 0);
        const entry = readdir(stream);
        if (!entry) { if (errno()) throw failure('Read directory entry'); break; }
        const name = koffi.decode(entry, darwin ? 21 : 19, 'char', -1) as string;
        if (name !== '.' && name !== '..') names.push(name);
      }
      return names.sort();
    } finally { closedir(stream); }
  }
  read(name: string): string {
    const fd = this.open(name);
    try {
      if (!fs.fstatSync(fd).isFile()) throw new Error(`${name} is not a regular file`);
      return fs.readFileSync(fd, 'utf8');
    } finally { fs.closeSync(fd); }
  }
  readBytes(name: string): Buffer {
    const fd=this.open(name);
    try {
      const before=fs.fstatSync(fd); if(!before.isFile()) throw new Error('Not a regular file');
      const bytes=fs.readFileSync(fd); const after=fs.fstatSync(fd);
      if(before.size!==after.size || before.mtimeMs!==after.mtimeMs) throw new Error('File changed while reading');
      return bytes;
    } finally {fs.closeSync(fd);}
  }
  renameExclusive(from: string, to: string) {
    component(from);component(to);
    if(renameExclusive(this.fd,from,this.fd,to,darwin?4:1)!==0) throw failure('Publish snapshot without overwrite');
  }
  replaceFile(from: string, to: string) {
    component(from); component(to);
    // rename replaces the directory entry itself; it never follows a destination symlink.
    if (renameReplace(this.fd, from, this.fd, to) !== 0) throw failure('Publish index');
  }
  unlinkFile(name: string) {
    component(name);
    if (unlinkat(this.fd, name, 0) !== 0) throw failure('Remove owned file');
  }
  removeOwned(name: string, opened: SafeDir) {
    component(name);
    const current=this.dir(name);
    try {
      const a=fs.fstatSync(current.fd), b=fs.fstatSync(opened.fd);
      if(a.dev!==b.dev || a.ino!==b.ino) throw new Error('Staging directory changed; cleanup refused');
    } finally {current.close();}
    for(const item of opened.names()) {
      const fd=opened.open(item);let isDir:boolean;
      try {isDir=fs.fstatSync(fd).isDirectory();} finally {fs.closeSync(fd);}
      if(isDir) {const child=opened.dir(item);try{opened.removeOwned(item,child);}finally{child.close();}}
      else if(unlinkat(opened.fd,item,0)!==0) throw failure('Remove staging file');
    }
    if(unlinkat(this.fd,name,darwin?0x80:0x200)!==0) throw failure('Remove staging directory');
  }
  mkdir(name: string) { component(name); if (mkdirat(this.fd, name, 0o700) !== 0) throw failure(`Create directory ${name}`); }
  writeNew(name: string, content: string | Buffer) {
    component(name);
    const fd = openat(this.fd, name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 'unsigned int', 0o600) as number;
    if (fd < 0) throw failure(`Exclusive create ${name}`);
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } catch(e) { unlinkat(this.fd,name,0); throw e; } finally { fs.closeSync(fd); }
  }
}

export function createRoot(target: string): SafeDir {
  const missing: string[] = [];
  let anchor = path.resolve(target);
  while (!fs.existsSync(anchor)) { const parent=path.dirname(anchor); if (parent===anchor) throw new Error('No accessible ancestor'); missing.unshift(path.basename(anchor)); anchor=parent; }
  let current=SafeDir.open(anchor);
  try {
    for (const part of missing) {
      current.mkdir(part);
      const next=current.dir(part); current.close(); current=next;
    }
    return current;
  } catch (e) { current.close(); throw e; }
}

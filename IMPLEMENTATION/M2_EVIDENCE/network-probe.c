#include <sys/socket.h>
#include <netinet/in.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>
int main(void) { int s=socket(AF_INET,SOCK_STREAM,0); struct sockaddr_in a={0}; a.sin_family=AF_INET; a.sin_port=htons(9); a.sin_addr.s_addr=htonl(0x7f000001); int r=connect(s,(struct sockaddr*)&a,sizeof(a)); int e=errno; printf("connect=%d errno=%d\n",r,e); close(s); return r==-1 && e==EPERM ? 0:1; }

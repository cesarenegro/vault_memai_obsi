#include <unistd.h>
#include <stdlib.h>
int main(void){setenv("PATH","/usr/bin:/bin",1);chdir("/private/tmp/limen-m3-e2e-l2pmo_uq");execl("/usr/bin/sandbox-exec","sandbox-exec","-f","/private/tmp/limen-m3-e2e-l2pmo_uq/offline.sb","/private/tmp/limen-m3-e2e-l2pmo_uq/LIMEN Vault.app/Contents/MacOS/limen-vault-real",(char*)0);return 127;}

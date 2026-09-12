#include <unistd.h>
#include <stdlib.h>
int main(void){setenv("PATH","/usr/bin:/bin",1);chdir("/private/tmp/limen-m4-ui-ltep9ush");execl("/usr/bin/sandbox-exec","sandbox-exec","-f","/private/tmp/limen-m4-ui-ltep9ush/offline.sb","/private/tmp/limen-m4-ui-ltep9ush/LIMEN Vault.app/Contents/MacOS/limen-vault-real",(char*)0);return 127;}

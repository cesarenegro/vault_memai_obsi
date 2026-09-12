#include <unistd.h>
#include <stdlib.h>
int main(void) {
setenv("PATH", "/usr/bin:/bin", 1);
chdir("/private/tmp/limen-m2-standalone-ctiat0cj");
execl("/usr/bin/sandbox-exec", "sandbox-exec", "-f", "/private/tmp/limen-m2-standalone-ctiat0cj/offline.sb", "/private/tmp/limen-m2-standalone-ctiat0cj/LIMEN Vault.app/Contents/MacOS/limen-vault-real", (char*)0);
return 127;
}

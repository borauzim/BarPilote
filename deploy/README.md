# Déploiement automatique BarPilote sur un VPS

Le workflow `.github/workflows/deploy.yml` se déclenche après chaque push sur `main`. Il ouvre une connexion SSH vers le VPS et demande à `deploy/deploy.sh` de déployer exactement le commit poussé.

## 1. Préparer le VPS une seule fois

Exemple Ubuntu, en remplaçant le domaine et l’utilisateur si nécessaire :

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip nginx redis-server
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/barpilote
sudo chown deploy:www-data /var/www/barpilote
sudo -u deploy git clone https://github.com/borauzim/BarPilote.git /var/www/barpilote
sudo -u deploy python3 -m venv /var/www/barpilote/.venv
sudo -u deploy cp /var/www/barpilote/deploy/.env.production.example /var/www/barpilote/.env
sudo chmod 640 /var/www/barpilote/.env
```

Éditer `/var/www/barpilote/.env` et remplacer toutes les valeurs d’exemple. Générer la clé Django avec :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Installer ensuite les services après avoir adapté le domaine et les chemins :

```bash
sudo cp /var/www/barpilote/deploy/barpilote.service.example /etc/systemd/system/barpilote.service
sudo cp /var/www/barpilote/deploy/nginx.conf.example /etc/nginx/sites-available/barpilote
sudo ln -s /etc/nginx/sites-available/barpilote /etc/nginx/sites-enabled/barpilote
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now redis-server barpilote nginx
```

Ajouter une permission très limitée pour permettre au compte `deploy` de redémarrer uniquement ce service :

```bash
sudo visudo -f /etc/sudoers.d/barpilote-deploy
```

Contenu :

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart barpilote, /usr/bin/systemctl is-active --quiet barpilote
```

## 2. Créer la clé SSH de déploiement

Sur votre ordinateur :

```bash
ssh-keygen -t ed25519 -C "github-barpilote-deploy" -f ~/.ssh/barpilote_deploy
ssh-copy-id -i ~/.ssh/barpilote_deploy.pub deploy@IP_DU_VPS
ssh-keyscan -H IP_DU_VPS
```

Ne publiez jamais la clé privée.

## 3. Ajouter les secrets GitHub

Dans le dépôt GitHub : **Settings → Environments → New environment → `production`**, puis ajouter ces secrets :

- `VPS_HOST` : IP ou domaine du VPS
- `VPS_PORT` : généralement `22`
- `VPS_USER` : `deploy`
- `VPS_APP_PATH` : `/var/www/barpilote`
- `VPS_SSH_KEY` : contenu complet de `~/.ssh/barpilote_deploy`
- `VPS_KNOWN_HOSTS` : sortie vérifiée de `ssh-keyscan -H IP_DU_VPS`

Vous pouvez protéger l’environnement `production` avec une approbation manuelle avant déploiement.

## 4. Premier déploiement et déploiements suivants

Effectuer le premier lancement sur le VPS :

```bash
cd /var/www/barpilote
bash deploy/deploy.sh "$(git rev-parse HEAD)"
```

Ensuite, chaque `git push origin main` déclenche automatiquement : récupération du commit, sauvegarde SQLite, installation des dépendances, contrôles Django, migrations, `collectstatic` et redémarrage de Daphne.

Les dix sauvegardes SQLite les plus récentes sont conservées dans `/var/www/barpilote/backups/`.

## Vérification

```bash
sudo systemctl status barpilote
sudo journalctl -u barpilote -n 100 --no-pager
```

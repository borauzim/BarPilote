#!/bin/bash

# Script d'activation de l'environnement virtuel Django
# Usage: ./activate-env.sh

echo "🔧 Activation de l'environnement virtuel Django..."

# Vérifier si nous sommes dans le bon répertoire
if [ ! -d "BarPilote" ]; then
    echo "❌ Erreur: Le répertoire BarPilote n'a pas été trouvé."
    echo "📍 Veuillez exécuter ce script depuis le répertoire parent de BarPilote"
    exit 1
fi

# Aller au répertoire parent
cd ../

# Activer l'environnement virtuel
if [ -f ".venv/bin/activate" ]; then
    echo "✅ Activation de l'environnement virtuel..."
    source .venv/bin/activate
    echo "✅ Environnement virtuel activé"
else
    echo "❌ Erreur: L'environnement virtuel .venv/bin/activate n'a pas été trouvé."
    echo "📍 Veuillez créer l'environnement virtuel d'abord:"
    echo "   python3 -m venv .venv"
    echo "   source .venv/bin/activate"
    exit 1
fi

# Aller dans le répertoire BarPilote
cd BarPilote

# Afficher les informations
echo "🚀 Environnement prêt pour Django !"
echo "📍 Répertoire actuel: $(pwd)"
echo "🐍 Version Python: $(python --version)"
echo "📦 Pip version: $(pip --version)"

# Afficher les commandes utiles
echo ""
echo "📋 Commandes utiles:"
echo "   python manage.py runserver     # Démarrer le serveur Django"
echo "   python manage.py migrate       # Appliquer les migrations"
echo "   python manage.py check          # Vérifier la configuration"
echo "   python manage.py shell          # Ouvrir le shell Django"
echo "   deactivate                     # Désactiver l'environnement"

-- Custom SQL migration file, put your code below! --
UPDATE payments SET tipo = notes, notes = NULL WHERE notes IN ('mora','penalidad');
